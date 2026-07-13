import { supabase } from "@/lib/supabase";

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

const PLANOS_FALLBACK: Plano[] = [
  {
    id: "bronze-corte",
    nome: "Plano Bronze Corte",
    descricao: "4 cortes no ciclo mensal",
    preco: 100,
    cortes_incluidos: 4,
    barbas_incluidas: 0,
    sobrancelhas_incluidas: 0,
    ativo: true,
    ordem: 1,
  },
  {
    id: "bronze-barba",
    nome: "Plano Bronze Barba",
    descricao: "4 barbas no ciclo mensal",
    preco: 60,
    cortes_incluidos: 0,
    barbas_incluidas: 4,
    sobrancelhas_incluidas: 0,
    ativo: true,
    ordem: 2,
  },
  {
    id: "prata",
    nome: "Plano Prata",
    descricao: "4 cortes e 4 sobrancelhas no ciclo mensal",
    preco: 110,
    cortes_incluidos: 4,
    barbas_incluidas: 0,
    sobrancelhas_incluidas: 4,
    ativo: true,
    ordem: 3,
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    descricao: "4 barbas, 4 cortes e 4 sobrancelhas no ciclo mensal",
    preco: 150,
    cortes_incluidos: 4,
    barbas_incluidas: 4,
    sobrancelhas_incluidas: 4,
    ativo: true,
    ordem: 4,
  },
];

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
