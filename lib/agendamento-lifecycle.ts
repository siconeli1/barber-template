import { liquidarCreditosDoAgendamento, registrarReceitaAvulsaDoAgendamento } from "@/lib/agendamento-planos";
import {
  projectAutoClosedAgendamentos,
  type StatusAgendamento,
  type StatusAtendimento,
  type StatusPagamento,
} from "@/lib/agendamento";
import { supabase } from "@/lib/supabase";

type ReconcileParams = {
  clienteId?: string;
  barbeiroId?: string;
  dateFrom?: string;
  dateTo?: string;
  agendamentoIds?: string[];
};

type ReconcileCandidate = {
  id: string;
  cliente_id?: string | null;
  barbeiro_id?: string | null;
  data: string;
  hora_fim: string;
  status?: string | null;
  status_agendamento?: StatusAgendamento | null;
  status_atendimento?: StatusAtendimento | null;
  status_pagamento?: StatusPagamento | null;
  concluido_em?: string | null;
};

export async function reconcileAgendamentosLifecycle(params: ReconcileParams = {}) {
  let query = supabase
    .from("agendamentos")
    .select("id, cliente_id, barbeiro_id, data, hora_fim, status, status_agendamento, status_atendimento, status_pagamento, concluido_em")
    .neq("status_agendamento", "cancelado")
    .neq("status_agendamento", "no_show")
    .neq("status_atendimento", "concluido");

  if (params.agendamentoIds && params.agendamentoIds.length > 0) {
    query = query.in("id", params.agendamentoIds);
  }
  if (params.clienteId) {
    query = query.eq("cliente_id", params.clienteId);
  }
  if (params.barbeiroId) {
    query = query.eq("barbeiro_id", params.barbeiroId);
  }
  if (params.dateFrom) {
    query = query.gte("data", params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte("data", params.dateTo);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const projected = projectAutoClosedAgendamentos((data ?? []) as ReconcileCandidate[]);
  const pendentes = projected.filter((item, index) => item.status_atendimento === "concluido" && data?.[index]?.status_atendimento !== "concluido");

  for (const item of pendentes) {
    const concluidoEm = item.concluido_em ?? new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("agendamentos")
      .update({
        status: "ativo",
        status_agendamento: "confirmado",
        status_atendimento: "concluido",
        concluido_em: concluidoEm,
      })
      .eq("id", item.id)
      .neq("status_agendamento", "cancelado")
      .neq("status_agendamento", "no_show")
      .neq("status_atendimento", "concluido")
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updated) {
      continue;
    }

    await liquidarCreditosDoAgendamento(item.id, "consumo_credito");
    await registrarReceitaAvulsaDoAgendamento(item.id);
  }

  return pendentes.length;
}
