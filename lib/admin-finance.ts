import { listAllBarbeiros } from "@/lib/barbeiros";
import {
  projectAutoClosedAgendamentos,
  type StatusAgendamento,
  type StatusAtendimento,
  type StatusPagamento,
} from "@/lib/agendamento";
import { supabase } from "@/lib/supabase";

export type FinancePeriod = "dia" | "semana" | "mes";
export type FinanceScope = "meu" | "geral";

type FinanceRow = {
  id: string;
  barbeiro_id: string;
  data: string;
  hora_fim: string;
  nome_cliente: string;
  servico_nome: string;
  valor_final: number | null;
  status_agendamento: StatusAgendamento;
  status_atendimento: StatusAtendimento;
  status_pagamento: StatusPagamento;
  tipo_cobranca: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getTodaySaoPauloIso(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(referenceDate);
}

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(iso: string, amount: number) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + amount);
  return toIso(date);
}

function formatDisplayDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function getFinanceRange(anchorDate: string, period: FinancePeriod) {
  const anchor = parseIsoDate(anchorDate);

  if (period === "dia") {
    return { inicio: anchorDate, fim: anchorDate, label: formatDisplayDate(anchorDate) };
  }

  if (period === "semana") {
    const inicio = anchorDate;
    const fim = addDays(anchorDate, 6);
    return {
      inicio,
      fim,
      label: `${formatDisplayDate(inicio)} ate ${formatDisplayDate(fim)}`,
    };
  }

  const hoje = parseIsoDate(getTodaySaoPauloIso());
  const diaLimite = hoje.getUTCDate();
  const inicio = `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-01`;
  const ultimoDiaMes = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  const fim = `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-${pad(Math.min(diaLimite, ultimoDiaMes))}`;
  return {
    inicio,
    fim,
    label: `${formatDisplayDate(inicio)} ate ${formatDisplayDate(fim)}`,
  };
}

function sumValor(rows: FinanceRow[]) {
  return rows.reduce((acc, row) => acc + Number(row.valor_final ?? 0), 0);
}

function isConcluded(row: FinanceRow) {
  return (
    row.status_agendamento !== "cancelado" &&
    row.status_agendamento !== "no_show" &&
    row.status_atendimento === "concluido"
  );
}

function isPending(row: FinanceRow) {
  return (
    row.status_agendamento !== "cancelado" &&
    row.status_agendamento !== "no_show" &&
    row.status_atendimento !== "concluido"
  );
}

function isNoShow(row: FinanceRow) {
  return row.status_agendamento === "no_show" || row.status_agendamento === "cancelado";
}

function buildMetrics(rows: FinanceRow[]) {
  const concluidos = rows.filter(isConcluded);
  const pendentes = rows.filter(isPending);
  const faltas = rows.filter(isNoShow);

  return {
    receita_gerada: sumValor(concluidos),
    receita_esperada: sumValor(concluidos) + sumValor(pendentes),
    concluidos: concluidos.length,
    pendentes: pendentes.length,
    faltas: faltas.length,
  };
}

export async function getFinanceSnapshot(params: {
  scope: FinanceScope;
  period: FinancePeriod;
  anchorDate: string;
  barbeiroId: string;
}) {
  const range = getFinanceRange(params.anchorDate, params.period);

  let query = supabase
    .from("agendamentos")
    .select("id, barbeiro_id, data, hora_fim, nome_cliente, servico_nome, valor_final, status_agendamento, status_atendimento, status_pagamento, tipo_cobranca")
    .gte("data", range.inicio)
    .lte("data", range.fim)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (params.scope === "meu") {
    query = query.eq("barbeiro_id", params.barbeiroId);
  }

  const [barbers, agendamentosRes, planosRes] = await Promise.all([
    listAllBarbeiros(),
    query,
    params.scope === "geral"
      ? supabase
          .from("financeiro_lancamentos")
          .select("valor")
          .eq("categoria_financeira", "receita_plano_mensal")
          .neq("status", "estornado")
          .gte("competencia", range.inicio)
          .lte("competencia", range.fim)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (agendamentosRes.error) {
    throw new Error(agendamentosRes.error.message);
  }

  if (planosRes.error) {
    throw new Error(planosRes.error.message);
  }

  const rows = projectAutoClosedAgendamentos((agendamentosRes.data ?? []) as FinanceRow[]);
  const metrics = buildMetrics(rows);
  const receitaPlanos = (planosRes.data ?? []).reduce((acc, row) => acc + Number(row.valor ?? 0), 0);

  const baseBarbers = params.scope === "meu" ? barbers.filter((barbeiro) => barbeiro.id === params.barbeiroId) : barbers;

  const porBarbeiro = baseBarbers.map((barbeiro) => {
    const barberRows = rows.filter((row) => row.barbeiro_id === barbeiro.id);
    const barberMetrics = buildMetrics(barberRows);
    return {
      barbeiro_id: barbeiro.id,
      barbeiro_nome: barbeiro.nome,
      ...barberMetrics,
    };
  });

  return {
    periodo: params.period,
    escopo: params.scope,
    referencia: params.anchorDate,
    faixa: range,
    resumo: {
      ...metrics,
      receita_planos: receitaPlanos,
      receita_gerada_com_planos: metrics.receita_gerada + receitaPlanos,
      receita_esperada_com_planos: metrics.receita_esperada + receitaPlanos,
    },
    por_barbeiro: porBarbeiro,
    agendamentos: rows,
  };
}
