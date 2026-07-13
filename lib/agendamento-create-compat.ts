import { supabase } from "@/lib/supabase";

type AgendamentoCreatePayload = {
  barbeiro_id: string;
  cliente_id: string | null;
  auth_user_id: string | null;
  assinatura_id: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  celular_cliente: string;
  servico_id: string;
  servico_nome: string;
  servico_duracao_minutos: number;
  servico_preco: number;
  valor_tabela: number;
  desconto: number;
  acrescimo: number;
  valor_final: number;
  status: string;
  status_agendamento: string;
  status_atendimento: string;
  status_pagamento: string;
  origem_agendamento: string;
  tipo_cobranca: string;
  cancelavel_ate: string;
  observacoes?: string | null;
};

type AgendamentoItemCreatePayload = {
  assinatura_id: string | null;
  servico_id: string;
  servico_nome: string;
  servico_categoria: string;
  servico_duracao_minutos: number;
  servico_preco: number;
  tipo_cobranca: "plano" | "avulso";
  status_credito: string;
  creditos_corte: number;
  creditos_barba: number;
  creditos_sobrancelha: number;
  ordem: number;
};

function isMissingAtomicCreateFunctionError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("create_agendamento_atomic") &&
    (normalized.includes("could not find the function") || normalized.includes("schema cache"))
  );
}

export async function createAgendamentoCompat(params: {
  agendamento: AgendamentoCreatePayload;
  itens: AgendamentoItemCreatePayload[];
}) {
  const { agendamento, itens } = params;
  const { data, error } = await supabase.rpc("create_agendamento_atomic", {
    p_agendamento: agendamento,
    p_itens: itens,
  });

  if (!error) {
    return data;
  }

  if (!isMissingAtomicCreateFunctionError(error.message)) {
    throw new Error(error.message);
  }

  if (itens.some((item) => item.tipo_cobranca === "plano")) {
    throw new Error(
      "Banco sem suporte atualizado para reservas com plano. Aplique a migration 20260330_security_and_atomic_ops.sql."
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("agendamentos")
    .insert(agendamento)
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || "Erro ao criar agendamento.");
  }

  if (itens.length > 0) {
    const itensInsert = itens.map((item) => ({
      ...item,
      agendamento_id: inserted.id,
    }));

    const { error: itensError } = await supabase.from("agendamento_itens").insert(itensInsert);

    if (itensError) {
      await supabase.from("agendamentos").delete().eq("id", inserted.id);
      throw new Error(itensError.message);
    }
  }

  return inserted;
}
