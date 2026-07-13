import { supabase } from "@/lib/supabase";
import barbershop from "@/barbershop.config";

export type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  cortes_incluidos: number;
  barbas_incluidas: number;
  sobrancelhas_incluidas: number;
  ativo: boolean;
  ordem: number;
};

const PLANOS_FALLBACK: Plano[] = barbershop.planos.map((plano, index) => ({
  id: plano.id,
  nome: plano.nome,
  descricao: plano.descricao,
  preco: plano.preco,
  cortes_incluidos: plano.cortes,
  barbas_incluidas: plano.barbas,
  sobrancelhas_incluidas: plano.sobrancelhas,
  ativo: true,
  ordem: index + 1,
}));

export async function listarPlanosAtivos() {
  try {
    const { data, error } = await supabase
      .from("planos")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const planos = (data ?? []) as Plano[];
    return planos.length > 0 ? planos : PLANOS_FALLBACK;
  } catch {
    return PLANOS_FALLBACK;
  }
}

export async function buscarPlanoPorId(planoId: string) {
  try {
    const { data, error } = await supabase
      .from("planos")
      .select("*")
      .eq("id", planoId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as Plano | null;
  } catch {
    return PLANOS_FALLBACK.find((item) => item.id === planoId) ?? null;
  }
}
