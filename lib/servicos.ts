import { supabase } from "@/lib/supabase";

export interface Servico {
  id: string;
  codigo: string;
  nome: string;
  categoria: "corte" | "barba" | "sobrancelha" | "combo" | "outro";
  duracao_minutos: number;
  preco: number;
  ordem: number;
  ativo: boolean;
}

export type ServicePlanCoverage = {
  corte: number;
  barba: number;
  sobrancelha: number;
};

const SERVICOS_FALLBACK: Servico[] = [
  {
    id: "barba",
    codigo: "barba",
    nome: "Barba",
    categoria: "barba",
    duracao_minutos: 30,
    preco: 30,
    ordem: 1,
    ativo: true,
  },
  {
    id: "acabamento",
    codigo: "acabamento",
    nome: "Acabamento",
    categoria: "outro",
    duracao_minutos: 10,
    preco: 15,
    ordem: 2,
    ativo: true,
  },
  {
    id: "cabelo-barba",
    codigo: "cabelo-barba",
    nome: "Cabelo + barba",
    categoria: "combo",
    duracao_minutos: 60,
    preco: 70,
    ordem: 3,
    ativo: true,
  },
  {
    id: "combo-cabelo-barba-sobrancelha",
    codigo: "combo-cabelo-barba-sobrancelha",
    nome: "Combo cabelo + barba + sobrancelha",
    categoria: "combo",
    duracao_minutos: 60,
    preco: 75,
    ordem: 4,
    ativo: true,
  },
  {
    id: "corte-de-cabelo",
    codigo: "corte-de-cabelo",
    nome: "Corte de cabelo",
    categoria: "corte",
    duracao_minutos: 30,
    preco: 40,
    ordem: 5,
    ativo: true,
  },
  {
    id: "corte-cabelo-sobrancelha",
    codigo: "corte-cabelo-sobrancelha",
    nome: "Corte de cabelo + sobrancelha",
    categoria: "combo",
    duracao_minutos: 30,
    preco: 50,
    ordem: 6,
    ativo: true,
  },
  {
    id: "depilacao-nariz",
    codigo: "depilacao-nariz",
    nome: "Depilacao de nariz",
    categoria: "outro",
    duracao_minutos: 10,
    preco: 20,
    ordem: 7,
    ativo: true,
  },
];

async function loadServicosFromDatabase() {
  const { data, error } = await supabase
    .from("servicos")
    .select("id, codigo, nome, categoria, duracao_minutos, preco, ordem, ativo")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Servico[];
}

export async function listarServicosAtivos() {
  try {
    const servicos = await loadServicosFromDatabase();
    const ativos = servicos.filter((servico) => servico.ativo !== false);
    return ativos.length > 0 ? ativos : SERVICOS_FALLBACK;
  } catch {
    return SERVICOS_FALLBACK;
  }
}

export async function encontrarServicoAtivo(params: { id?: string | null; codigo?: string | null }) {
  const match = String(params.id ?? params.codigo ?? "").trim().toLowerCase();

  if (!match) {
    return null;
  }

  const servicos = await listarServicosAtivos();
  return servicos.find((servico) => servico.id.toLowerCase() === match || servico.codigo.toLowerCase() === match) ?? null;
}

export async function encontrarServicosAtivosPorIds(serviceIds: string[]) {
  const ids = Array.from(new Set(serviceIds.map((item) => item.trim()).filter(Boolean)));
  if (ids.length === 0) return [];

  const servicos = await listarServicosAtivos();
  return servicos.filter((servico) => ids.includes(servico.id) || ids.includes(servico.codigo));
}

export function getServicePlanCoverage(servico: Pick<Servico, "id" | "codigo" | "categoria">): ServicePlanCoverage {
  const key = String(servico.id || servico.codigo).trim().toLowerCase();

  switch (key) {
    case "corte-de-cabelo":
      return { corte: 1, barba: 0, sobrancelha: 0 };
    case "barba":
      return { corte: 0, barba: 1, sobrancelha: 0 };
    case "corte-cabelo-sobrancelha":
      return { corte: 1, barba: 0, sobrancelha: 1 };
    case "cabelo-barba":
      return { corte: 1, barba: 1, sobrancelha: 0 };
    case "combo-cabelo-barba-sobrancelha":
      return { corte: 1, barba: 1, sobrancelha: 1 };
    default:
      if (servico.categoria === "corte") {
        return { corte: 1, barba: 0, sobrancelha: 0 };
      }
      if (servico.categoria === "barba") {
        return { corte: 0, barba: 1, sobrancelha: 0 };
      }
      if (servico.categoria === "sobrancelha") {
        return { corte: 0, barba: 0, sobrancelha: 1 };
      }
      return { corte: 0, barba: 0, sobrancelha: 0 };
  }
}

export function hasPlanCoverage(servico: Pick<Servico, "id" | "codigo" | "categoria">) {
  const coverage = getServicePlanCoverage(servico);
  return coverage.corte + coverage.barba + coverage.sobrancelha > 0;
}
