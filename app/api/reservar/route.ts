import { NextResponse } from "next/server";
import { isAllowedSlotForBusyState, validateBusinessSlot, validateCustomerBookingDate } from "@/lib/agenda-booking";
import { minutesToTime } from "@/lib/agenda";
import { getBusyIntervals } from "@/lib/agenda-conflicts";
import { findBarbeiroById, listActiveBarbeiros } from "@/lib/barbeiros";
import { findOrCreateCliente } from "@/lib/customer-auth";
import { encontrarServicosAtivosPorIds } from "@/lib/servicos";
import { createAgendamentoCompat } from "@/lib/agendamento-create-compat";
import {
  calcularValorFinalDosItens,
  decidirCoberturaServicoNoPlano,
  decidirCobrancaItens,
} from "@/lib/agendamento-planos";

function buildCancelavelAte(data: string, horaInicio: string) {
  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = horaInicio.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute - 120).toISOString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const nome = String(body?.nome ?? "").trim();
    const telefone = String(body?.telefone ?? "").trim();
    const data = body?.data as string | undefined;
    const horaInicio = body?.hora_inicio as string | undefined;
    const barbeiroIdParam = body?.barbeiro_id as string | undefined;
    const confirmarAvulso = Boolean(body?.confirmar_avulso);
    const serviceIds = Array.isArray(body?.service_ids)
      ? body.service_ids.map((item: unknown) => String(item))
      : body?.servico_id
        ? [String(body.servico_id)]
        : [];

    if (!nome || !telefone) {
      return NextResponse.json({ erro: "Informe seu nome e telefone para agendar." }, { status: 400 });
    }

    if (!data || !horaInicio || serviceIds.length === 0) {
      return NextResponse.json({ erro: "Campos obrigatórios: data, hora_inicio e service_ids." }, { status: 400 });
    }

    const cliente = await findOrCreateCliente(nome, telefone);

    const dateValidation = validateCustomerBookingDate(data);
    if (!dateValidation.ok) {
      return NextResponse.json({ erro: dateValidation.erro }, { status: 409 });
    }

    const servicos = await encontrarServicosAtivosPorIds(serviceIds);
    if (servicos.length !== serviceIds.length) {
      return NextResponse.json({ erro: "Um ou mais serviços não foram encontrados." }, { status: 404 });
    }

    const duracaoTotal = servicos.reduce((acc, servico) => acc + Number(servico.duracao_minutos), 0);
    const valorTabela = servicos.reduce((acc, servico) => acc + Number(servico.preco), 0);
    const slotValidation = validateBusinessSlot(data, horaInicio, duracaoTotal);

    if (!slotValidation.ok) {
      return NextResponse.json({ erro: slotValidation.erro }, { status: 409 });
    }

    const fimReserva = slotValidation.fimReserva;

    let barbeiro = null;

    if (barbeiroIdParam && barbeiroIdParam !== "qualquer") {
      barbeiro = await findBarbeiroById(barbeiroIdParam);
      if (!barbeiro || !barbeiro.ativo) {
        return NextResponse.json({ erro: "Barbeiro não encontrado ou inativo." }, { status: 404 });
      }

      const busyState = await getBusyIntervals(data, barbeiro.id);
      if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
        return NextResponse.json({ erro: "Barbeiro indisponível nesta data." }, { status: 409 });
      }

      if (!isAllowedSlotForBusyState(data, slotValidation.day, duracaoTotal, horaInicio, busyState)) {
        return NextResponse.json({ erro: "Horário indisponível para este barbeiro." }, { status: 409 });
      }
    } else {
      const barbeiros = await listActiveBarbeiros();

      for (const candidato of barbeiros) {
        const busyState = await getBusyIntervals(data, candidato.id);

        if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
          continue;
        }

        if (isAllowedSlotForBusyState(data, slotValidation.day, duracaoTotal, horaInicio, busyState)) {
          barbeiro = candidato;
          break;
        }
      }

      if (!barbeiro) {
        return NextResponse.json({ erro: "Nenhum barbeiro disponível neste horário." }, { status: 409 });
      }
    }

    const cobertura =
      servicos.length === 1
        ? await decidirCoberturaServicoNoPlano(cliente.id, servicos[0])
        : null;

    const cobranca = await decidirCobrancaItens(cliente.id, servicos);
    if (cobertura?.requires_avulso_confirmation && !confirmarAvulso) {
      return NextResponse.json({
        erro: cobertura.mensagem || "Seu plano não cobre este serviço com saldo disponível.",
        requires_avulso_confirmation: true,
        cobertura,
      }, { status: 409 });
    }

    const itensCobranca =
      confirmarAvulso && cobertura?.requires_avulso_confirmation
        ? cobranca.itens.map((item) => ({
            ...item,
            tipo_cobranca: "avulso" as const,
            status_credito: "nao_aplicavel" as const,
            assinatura_id: null,
            creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
            cobertura_plano: {
              ...item.cobertura_plano,
              confirmar_como: "avulso" as const,
            },
          }))
        : cobranca.itens;

    const tipoCobranca = itensCobranca.every((item) => item.tipo_cobranca === "plano")
      ? "plano"
      : itensCobranca.every((item) => item.tipo_cobranca === "avulso")
        ? "avulso"
        : "misto";

    const valorFinal = calcularValorFinalDosItens(itensCobranca);
    const servicoResumo = servicos.map((servico) => servico.nome).join(" + ");
    const assinaturaAgendamentoId = itensCobranca.some((item) => item.tipo_cobranca === "plano")
      ? cobranca.assinatura?.id ?? null
      : null;

    const itensPayload = itensCobranca.map((item, index) => ({
      assinatura_id: item.assinatura_id,
      servico_id: item.servico.id,
      servico_nome: item.servico.nome,
      servico_categoria: item.servico.categoria,
      servico_duracao_minutos: item.servico.duracao_minutos,
      servico_preco: item.servico.preco,
      tipo_cobranca: item.tipo_cobranca,
      status_credito: item.status_credito,
      creditos_corte: item.creditos_plano.corte,
      creditos_barba: item.creditos_plano.barba,
      creditos_sobrancelha: item.creditos_plano.sobrancelha,
      ordem: index + 1,
    }));

    let inserted;
    try {
      inserted = await createAgendamentoCompat({
        agendamento: {
          barbeiro_id: barbeiro.id,
          cliente_id: cliente.id,
          auth_user_id: null,
          assinatura_id: assinaturaAgendamentoId,
          data,
          hora_inicio: horaInicio,
          hora_fim: minutesToTime(fimReserva),
          nome_cliente: cliente.nome,
          celular_cliente: cliente.telefone,
          servico_id: servicos[0].id,
          servico_nome: servicoResumo,
          servico_duracao_minutos: duracaoTotal,
          servico_preco: valorTabela,
          valor_tabela: valorTabela,
          desconto: 0,
          acrescimo: 0,
          valor_final: valorFinal,
          status: "ativo",
          status_agendamento: "agendado",
          status_atendimento: "pendente",
          status_pagamento: "pendente",
          origem_agendamento: "site",
          tipo_cobranca: tipoCobranca,
          cancelavel_ate: buildCancelavelAte(data, horaInicio),
        },
        itens: itensPayload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao confirmar agendamento.";
      const msg = message.toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("exclusion") || msg.includes("overlap")) {
        return NextResponse.json({ erro: "Horário já reservado para esse período." }, { status: 409 });
      }
      if (msg.includes("saldo insuficiente")) {
        return NextResponse.json({ erro: "Seu plano não possui saldo suficiente para esse horário." }, { status: 409 });
      }
      return NextResponse.json({ erro: message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      agendamento: inserted,
      barbeiro: {
        id: barbeiro.id,
        nome: barbeiro.nome,
        slug: barbeiro.slug,
      },
      itens: itensPayload.map((item) => ({
        ...item,
        agendamento_id: (inserted as { id: string }).id,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao confirmar agendamento.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
