import { supabase } from "@/lib/supabase";
import barbershop from "@/barbershop.config";

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

const SERVICOS_FALLBACK: Servico[] = barbershop.servicos.map((servico, index) => ({
  id: servico.id,
  codigo: servico.id,
  nome: servico.nome,
  categoria: servico.categoria,
  duracao_minutos: servico.duracaoMinutos,
  preco: servico.preco,
  ordem: index + 1,
  ativo: true,
}));

const COBERTURA_POR_SERVICO = new Map<string, ServicePlanCoverage>(
  barbershop.servicos
    .filter((servico) => servico.coberturaPlano)
    .map((servico) => [servico.id.toLowerCase(), servico.coberturaPlano!])
);

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

  const coberturaConfigurada = COBERTURA_POR_SERVICO.get(key);
  if (coberturaConfigurada) {
    return coberturaConfigurada;
  }

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

export function hasPlanCoverage(servico: Pick<Servico, "id" | "codigo" | "categoria">) {
  const coverage = getServicePlanCoverage(servico);
  return coverage.corte + coverage.barba + coverage.sobrancelha > 0;
}
