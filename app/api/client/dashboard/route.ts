import { NextResponse } from "next/server";
import {
  buscarAssinaturaAtiva,
  listarMovimentacoesCliente,
} from "@/lib/assinaturas";
import { getClienteByTelefone, getTelefoneFromRequest } from "@/lib/customer-auth";
import { buscarPlanoPorId } from "@/lib/planos";
import { supabase } from "@/lib/supabase";
import { projectAutoClosedAgendamentos } from "@/lib/agendamento";

const CATEGORIA_LABEL: Record<string, string> = {
  corte: "corte",
  barba: "barba",
  sobrancelha: "sobrancelha",
  outro: "credito",
};

const MOVIMENTACAO_LABEL: Record<string, string> = {
  reserva_credito: "Reserva do plano",
  consumo_credito: "Uso do plano",
  devolucao_credito: "Devolucao do plano",
  troca_imediata: "Troca imediata",
  uso_manual: "Uso manual",
};

function formatarCategoriasResumo(categorias: string[]) {
  const itens = categorias.map((categoria) => CATEGORIA_LABEL[categoria] ?? categoria);

  if (itens.length <= 1) {
    return itens[0] ?? "credito";
  }

  if (itens.length === 2) {
    return `${itens[0]} e ${itens[1]}`;
  }

  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function getDateFromIsoString(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isDateWithinCycle(value: string, inicioCiclo: string, fimCiclo: string) {
  const date = getDateFromIsoString(value);
  if (!date) {
    return false;
  }

  const isoDate = date.toISOString().slice(0, 10);
  return isoDate >= inicioCiclo && isoDate <= fimCiclo;
}

export async function GET(request: Request) {
  try {
    const telefone = getTelefoneFromRequest(request);

    if (!telefone) {
      return NextResponse.json({ erro: "Informe o telefone." }, { status: 400 });
    }

    const cliente = await getClienteByTelefone(telefone);

    if (!cliente) {
      return NextResponse.json({ profile: null, assinatura: null, plano: null, reservas: [], financeiro: [], historico_uso: [] });
    }

    const [assinatura, reservasRes, financeiroRes] = await Promise.all([
      buscarAssinaturaAtiva(cliente.id),
      supabase
        .from("agendamentos")
        .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, valor_final, status_agendamento, status_atendimento, status_pagamento, tipo_cobranca, barbeiro_id, barbeiros(nome)")
        .eq("cliente_id", cliente.id)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false }),
      supabase
        .from("financeiro_lancamentos")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("competencia", { ascending: false }),
    ]);

    if (reservasRes.error || financeiroRes.error) {
      throw new Error(reservasRes.error?.message || financeiroRes.error?.message || "Erro ao carregar dashboard.");
    }

    const reservas = projectAutoClosedAgendamentos(reservasRes.data ?? []);
    const plano = assinatura ? await buscarPlanoPorId(assinatura.plano_id) : null;
    const historicoUsoBruto = (await listarMovimentacoesCliente(cliente.id))
      .filter((item) => item.tipo_movimentacao !== "renovacao" && item.tipo_movimentacao !== "reserva_credito")
      .filter((item) => {
        if (!assinatura?.inicio_ciclo || !assinatura?.fim_ciclo) {
          return false;
        }
        return isDateWithinCycle(item.created_at, assinatura.inicio_ciclo, assinatura.fim_ciclo);
      });
    const agendamentoPorId = new Map(
      reservas.map((item) => [
        String(item.id),
        {
          servicoNome: item.servico_nome ?? null,
          data: item.data ?? null,
          horaInicio: item.hora_inicio ?? null,
          horaFim: item.hora_fim ?? null,
          barbeiroNome: getBarbeiroNome(item),
          statusAgendamento: item.status_agendamento ?? null,
          statusAtendimento: item.status_atendimento ?? null,
        },
      ])
    );

    const agrupado = historicoUsoBruto.reduce((acc, item) => {
      const groupKey = item.agendamento_id
        ? `${item.agendamento_id}:${item.tipo_movimentacao}`
        : item.id;
      const existente = acc.get(groupKey);

      if (existente) {
        existente.quantidade += Number(item.quantidade ?? 1);
        if (item.categoria_servico && !existente.categorias.includes(item.categoria_servico)) {
          existente.categorias.push(item.categoria_servico);
        }
        if (item.created_at > existente.created_at) {
          existente.created_at = item.created_at;
        }
        return acc;
      }

      acc.set(groupKey, {
        id: groupKey,
        agendamento_id: item.agendamento_id,
        tipo_movimentacao: item.tipo_movimentacao,
        quantidade: Number(item.quantidade ?? 1),
        categorias: item.categoria_servico ? [item.categoria_servico] : [],
        created_at: item.created_at,
      });

      return acc;
    }, new Map<string, {
      id: string;
      agendamento_id: string | null;
      tipo_movimentacao: string;
      quantidade: number;
      categorias: string[];
      created_at: string;
    }>());

    const historicoUsoAgrupado = Array.from(agrupado.values())
      .map((item) => {
        const reserva = item.agendamento_id ? agendamentoPorId.get(item.agendamento_id) : null;
        const titulo =
          reserva?.servicoNome ||
          MOVIMENTACAO_LABEL[item.tipo_movimentacao] ||
          item.tipo_movimentacao;
        const categorias = item.categorias.filter(Boolean);
        const descricao =
          categorias.length > 0
            ? `${formatarCategoriasResumo(categorias)} - ${item.quantidade} credito(s)`
            : `${item.quantidade} credito(s)`;

        return {
          id: item.id,
          tipo_movimentacao: item.tipo_movimentacao,
          titulo,
          descricao,
          quantidade: item.quantidade,
          created_at: item.created_at,
          detalhes: reserva
            ? {
                data: reserva.data,
                hora_inicio: reserva.horaInicio,
                hora_fim: reserva.horaFim,
                barbeiro_nome: reserva.barbeiroNome,
                servico_nome: reserva.servicoNome,
                status_agendamento: reserva.statusAgendamento,
                status_atendimento: reserva.statusAtendimento,
              }
            : null,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return NextResponse.json({
      profile: cliente,
      assinatura,
      plano,
      reservas,
      financeiro: financeiroRes.data ?? [],
      historico_uso: historicoUsoAgrupado,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard do cliente.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}

function getBarbeiroNome(item: { barbeiros?: unknown }) {
  const relation = item.barbeiros;

  if (Array.isArray(relation)) {
    const first = relation[0] as { nome?: string } | undefined;
    return first?.nome ?? null;
  }

  if (relation && typeof relation === "object" && "nome" in relation) {
    return (relation as { nome?: string }).nome ?? null;
  }

  return null;
}
