import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calcularValorFinal, projectAutoClosedAgendamentos } from "@/lib/agendamento";
import { canAdminCancelAppointment, canConcludeAppointment, canMarkNoShow } from "@/lib/agendamento-rules";
import { requireAdminSession, resolveAdminBarbeiroScope } from "@/lib/admin-auth";
import {
  type AgendamentoItemPlanoDecision,
  calcularValorFinalDosItens,
  decidirCobrancaItens,
} from "@/lib/agendamento-planos";
import { getBusyIntervals, overlaps, parseTimeToMinutes } from "@/lib/agenda-conflicts";
import { minutesToTime } from "@/lib/agenda";
import { validateAdminManualSlot } from "@/lib/agenda-booking";
import { encontrarServicoAtivo } from "@/lib/servicos";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { createAgendamentoCompat } from "@/lib/agendamento-create-compat";
import { findOrCreateCliente } from "@/lib/customer-auth";

function buildCancelavelAte(data: string, horaInicio: string) {
  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = horaInicio.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute - 120).toISOString();
}

function describeConflictType(tipo: "agendamento" | "horario_customizado" | "bloqueio") {
  if (tipo === "agendamento") {
    return "Já existe um agendamento nesse intervalo.";
  }
  if (tipo === "horario_customizado") {
    return "Já existe uma reserva manual nesse intervalo.";
  }
  return "Existe um bloqueio ativo nesse intervalo.";
}

function getRouteErrorStatus(message: string) {
  if (message === "Não autorizado") {
    return 401;
  }
  if (message === "Sem permissão") {
    return 403;
  }
  if (message === "Barbeiro não encontrado.") {
    return 404;
  }
  return 500;
}

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, searchParams.get("barbeiro_id"));

    if (!data && !dateFrom) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 });
    }

    let agendamentoQuery = supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, status, status_agendamento, status_atendimento, status_pagamento, valor_tabela, desconto, acrescimo, valor_final, forma_pagamento, origem_agendamento, observacoes, concluido_em, cancelado_em, tipo_cobranca")
      .eq("barbeiro_id", targetBarbeiroId)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    let customQuery = supabase
      .from("horarios_customizados")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente")
      .eq("barbeiro_id", targetBarbeiroId)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (data) {
      agendamentoQuery = agendamentoQuery.eq("data", data);
      customQuery = customQuery.eq("data", data);
    } else {
      agendamentoQuery = agendamentoQuery.gte("data", dateFrom!).lte("data", dateTo || dateFrom!);
      customQuery = customQuery.gte("data", dateFrom!).lte("data", dateTo || dateFrom!);
    }

    const { data: agendamentosRaw, error } = await agendamentoQuery;
    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const agendamentos = projectAutoClosedAgendamentos(agendamentosRaw || []);
    const { data: horariosCustomizados, error: errorCustom } = await customQuery;
    if (errorCustom) {
      return NextResponse.json({ erro: errorCustom.message }, { status: 500 });
    }

    const todosAgendamentos = [
      ...(agendamentos || []).map((agendamento) => ({ ...agendamento, origem: "agendamento" })),
      ...(horariosCustomizados || []).map((hc) => ({
        id: hc.id,
        data: hc.data,
        hora_inicio: hc.hora_inicio,
        hora_fim: hc.hora_fim,
        nome_cliente: hc.nome_cliente || "Horário reservado",
        celular_cliente: hc.celular_cliente || "",
        servico_nome: "Horário personalizado",
        servico_preco: 0,
        status: "ativo",
        status_agendamento: "confirmado",
        status_atendimento: "concluido",
        status_pagamento: "pendente",
        valor_tabela: 0,
        desconto: 0,
        acrescimo: 0,
        valor_final: 0,
        forma_pagamento: null,
        origem_agendamento: "horario_customizado",
        observacoes: null,
        concluido_em: null,
        cancelado_em: null,
        origem: "horario_customizado",
        tipo_cobranca: "avulso",
      })),
    ];

    return NextResponse.json(todosAgendamentos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao carregar agenda.";
    return NextResponse.json({ erro: message }, { status: getRouteErrorStatus(message) });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const { id, status_agendamento, status_atendimento, status_pagamento, desconto, acrescimo, valor_final, forma_pagamento, observacoes } = body;

    if (!id) {
      return NextResponse.json({ erro: "ID obrigatório." }, { status: 400 });
    }

    const { data: atual, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, barbeiro_id, data, hora_inicio, hora_fim, cancelavel_ate, valor_tabela, desconto, acrescimo, status, status_agendamento, status_atendimento, status_pagamento, origem_agendamento")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!atual) {
      return NextResponse.json({ erro: "Agendamento não encontrado." }, { status: 404 });
    }

    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, atual.barbeiro_id);

    if (status_agendamento === "cancelado" && !canAdminCancelAppointment(atual)) {
      return NextResponse.json({ erro: "Este agendamento não pode mais ser cancelado." }, { status: 409 });
    }
    if (status_agendamento === "no_show" && !canMarkNoShow(atual)) {
      return NextResponse.json({ erro: "Só é possível marcar falta após o horário." }, { status: 409 });
    }
    if (status_atendimento === "concluido" && !canConcludeAppointment(atual)) {
      return NextResponse.json({ erro: "Só é possível concluir o atendimento após o horário marcado." }, { status: 409 });
    }

    const descontoFinal = desconto === undefined || desconto === null || desconto === "" ? Number(atual.desconto ?? 0) : Number(desconto);
    const acrescimoFinal = acrescimo === undefined || acrescimo === null || acrescimo === "" ? Number(atual.acrescimo ?? 0) : Number(acrescimo);
    const valorFinalCalculado = valor_final === undefined || valor_final === null || valor_final === ""
      ? calcularValorFinal({ valorTabela: Number(atual.valor_tabela ?? 0), desconto: descontoFinal, acrescimo: acrescimoFinal })
      : Number(valor_final);

    const patch: Record<string, string | number | null> = {
      desconto: descontoFinal,
      acrescimo: acrescimoFinal,
      valor_final: Math.max(0, valorFinalCalculado),
    };

    if (status_agendamento) {
      patch.status_agendamento = status_agendamento;
      patch.status = status_agendamento === "cancelado" ? "cancelado" : "ativo";
      if (status_agendamento === "cancelado") {
        patch.cancelado_em = new Date().toISOString();
      }
    }

    if (status_atendimento) {
      patch.status_atendimento = status_atendimento;
      if (status_atendimento === "concluido") {
        patch.concluido_em = new Date().toISOString();
      }
    }

    if (status_pagamento) patch.status_pagamento = status_pagamento;
    if (forma_pagamento !== undefined) patch.forma_pagamento = forma_pagamento || null;
    if (observacoes !== undefined) patch.observacoes = observacoes || null;

    const { data: atualizado, error } = await supabase.rpc("apply_agendamento_update_atomic", {
      p_agendamento_id: id,
      p_barbeiro_id: targetBarbeiroId,
      p_patch: patch,
    });

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, agendamento: atualizado });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao atualizar agendamento.";
    return NextResponse.json({ erro: message }, { status: getRouteErrorStatus(message) });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const data = String(body?.data ?? "").trim();
    const horaInicio = String(body?.hora_inicio ?? "").trim();
    const servicoId = String(body?.servico_id ?? "").trim();
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, body?.barbeiro_id ? String(body.barbeiro_id) : null);
    const clienteId = body?.cliente_id ? String(body.cliente_id).trim() : "";
    const nomeManual = String(body?.nome_cliente ?? "").trim();
    const celularManual = normalizePhone(body?.celular_cliente) || "";
    const observacoes = body?.observacoes ? String(body.observacoes) : null;
    const preferenciaCobranca = body?.preferencia_cobranca === "avulso" ? "avulso" : "plano";

    if (!data || !horaInicio || !servicoId) {
      return NextResponse.json({ erro: "Data, horário e serviço são obrigatórios." }, { status: 400 });
    }

    const servico = await encontrarServicoAtivo({ id: servicoId });
    if (!servico) {
      return NextResponse.json({ erro: "Serviço não encontrado." }, { status: 404 });
    }

    const slotValidation = validateAdminManualSlot(data, horaInicio, Number(servico.duracao_minutos));
    if (!slotValidation.ok) {
      return NextResponse.json({ erro: slotValidation.erro }, { status: 409 });
    }

    let clienteIdFinal: string | null = null;
    let nomeClienteFinal = nomeManual;
    let celularClienteFinal = celularManual;

    if (clienteId) {
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("id", clienteId)
        .maybeSingle();

      if (clienteError) {
        return NextResponse.json({ erro: clienteError.message }, { status: 500 });
      }

      if (!cliente) {
        return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
      }

      clienteIdFinal = cliente.id;
      nomeClienteFinal = cliente.nome;
      celularClienteFinal = normalizePhone(cliente.telefone);
    }

    if (!nomeClienteFinal || !celularClienteFinal) {
      return NextResponse.json({ erro: "Selecione um cliente cadastrado ou informe nome e celular." }, { status: 400 });
    }

    celularClienteFinal = normalizePhone(celularClienteFinal);

    if (!isValidPhone(celularClienteFinal)) {
      return NextResponse.json({ erro: "Informe um celular válido com DDD para a marcação manual." }, { status: 400 });
    }

    if (!clienteIdFinal) {
      try {
        const clienteVinculado = await findOrCreateCliente(nomeClienteFinal, celularClienteFinal);
        clienteIdFinal = clienteVinculado.id;
        nomeClienteFinal = clienteVinculado.nome;
        celularClienteFinal = clienteVinculado.telefone;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível vincular o cliente.";
        return NextResponse.json({ erro: message }, { status: 400 });
      }
    }

    const inicioReserva = parseTimeToMinutes(horaInicio);
    const fimReserva = slotValidation.fimReserva;

    const busyState = await getBusyIntervals(data, targetBarbeiroId);
    if (busyState.bloqueioDiaInteiro) {
      return NextResponse.json({ erro: "Você bloqueou o dia inteiro para esta data." }, { status: 409 });
    }
    if (busyState.naoAceitarMais) {
      return NextResponse.json({ erro: "Existe um bloqueio de não aceitar mais horários nessa data." }, { status: 409 });
    }

    const conflito = busyState.intervalos.find((intervalo) => overlaps(inicioReserva, fimReserva, intervalo.inicio, intervalo.fim));
    if (conflito) {
      return NextResponse.json({ erro: describeConflictType(conflito.tipo) }, { status: 409 });
    }

    const servicos = [servico];
    const valorTabela = Number(servico.preco);
    const cobrancaSemPlano: {
      assinatura: null;
      itens: AgendamentoItemPlanoDecision[];
      itensSemSaldo: [];
    } = {
      assinatura: null,
      itens: [
        {
          servico,
          tipo_cobranca: "avulso",
          status_credito: "nao_aplicavel",
          assinatura_id: null,
          creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
          cobertura_plano: {
            status: "sem_plano",
            confirmar_como: "avulso",
            servico_referencia: null,
            mensagem: null,
            warning_tone: null,
            requires_avulso_confirmation: false,
          },
        },
      ],
      itensSemSaldo: [],
    };

    const cobrancaBase = clienteIdFinal ? await decidirCobrancaItens(clienteIdFinal, servicos) : cobrancaSemPlano;
    const cobranca = preferenciaCobranca === "avulso"
      ? {
          assinatura: null,
          itens: cobrancaBase.itens.map((item) => ({
            ...item,
            tipo_cobranca: "avulso" as const,
            status_credito: "nao_aplicavel" as const,
            assinatura_id: null,
            creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
            cobertura_plano: {
              status: "sem_plano" as const,
              confirmar_como: "avulso" as const,
              servico_referencia: null,
              mensagem: null,
              warning_tone: null,
              requires_avulso_confirmation: false,
            },
          })),
          itensSemSaldo: [],
        }
      : cobrancaBase;
    const avisoPreferencia =
      preferenciaCobranca === "avulso" && clienteIdFinal && cobrancaBase.assinatura
        ? "Cliente lançado como serviço avulso por escolha manual do barbeiro."
        : null;

    const tipoCobranca = cobranca.itens.every((item) => item.tipo_cobranca === "plano")
      ? "plano"
      : cobranca.itens.every((item) => item.tipo_cobranca === "avulso")
        ? "avulso"
        : "misto";

    const valorFinal = calcularValorFinalDosItens(cobranca.itens);
    const assinaturaAgendamentoId = cobranca.itens.some((item) => item.tipo_cobranca === "plano")
      ? cobranca.assinatura?.id ?? null
      : null;

    const itensPayload = cobranca.itens.map((item, index) => ({
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
          barbeiro_id: targetBarbeiroId,
          cliente_id: clienteIdFinal,
          auth_user_id: null,
        assinatura_id: assinaturaAgendamentoId,
        data,
        hora_inicio: horaInicio,
        hora_fim: minutesToTime(fimReserva),
        nome_cliente: nomeClienteFinal,
        celular_cliente: celularClienteFinal,
        servico_id: servico.id,
        servico_nome: servico.nome,
        servico_duracao_minutos: servico.duracao_minutos,
        servico_preco: valorTabela,
        valor_tabela: valorTabela,
        desconto: 0,
        acrescimo: 0,
        valor_final: valorFinal,
        status: "ativo",
        status_agendamento: "confirmado",
        status_atendimento: "pendente",
        status_pagamento: "pendente",
        origem_agendamento: "admin_manual",
        tipo_cobranca: tipoCobranca,
        cancelavel_ate: buildCancelavelAte(data, horaInicio),
          observacoes,
        },
        itens: itensPayload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno ao criar agendamento manual.";
      const msg = message.toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("exclusion") || msg.includes("overlap")) {
        return NextResponse.json({ erro: "Já existe um atendimento nesse intervalo." }, { status: 409 });
      }
      if (msg.includes("saldo insuficiente")) {
        return NextResponse.json({ erro: "Cliente com plano sem saldo suficiente para essa marcação." }, { status: 409 });
      }
      return NextResponse.json({ erro: message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      agendamento: inserted,
      aviso:
        avisoPreferencia ??
        (clienteIdFinal && cobranca.itensSemSaldo.length > 0
          ? "Cliente com plano sem saldo suficiente. Horário lançado como serviço avulso."
          : null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar agendamento manual.";
    return NextResponse.json({ erro: message }, { status: getRouteErrorStatus(message) });
  }
}
