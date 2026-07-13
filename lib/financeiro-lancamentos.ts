import { supabase } from "@/lib/supabase";

export async function registrarReceitaPlanoMensal(params: {
  clienteId: string;
  assinaturaId: string;
  planoNome: string;
  valor: number;
  competencia: string;
  tipo: "adesao" | "renovacao";
}) {
  const descricao =
    params.tipo === "adesao"
      ? `Adesao ao plano ${params.planoNome}`
      : `Renovacao do plano ${params.planoNome}`;

  const { data: existente, error: existenteError } = await supabase
    .from("financeiro_lancamentos")
    .select("id")
    .eq("assinatura_id", params.assinaturaId)
    .eq("categoria_financeira", "receita_plano_mensal")
    .eq("competencia", params.competencia)
    .eq("descricao", descricao)
    .maybeSingle();

  if (existenteError) {
    throw new Error(existenteError.message);
  }

  if (existente) {
    return existente;
  }

  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .insert({
      cliente_id: params.clienteId,
      assinatura_id: params.assinaturaId,
      categoria_financeira: "receita_plano_mensal",
      descricao,
      valor: params.valor,
      competencia: params.competencia,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
