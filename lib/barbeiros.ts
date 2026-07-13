import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/security";

export interface Barbeiro {
  id: string;
  nome: string;
  slug: string;
  login: string;
  senha_hash: string;
  cargo: "socio" | "barbeiro";
  ativo: boolean;
  ordem: number;
  foto_url: string | null;
}

const BARBEIROS_AUTORIZADOS = [
  {
    id: "lucas-cantelle",
    nome: "Cantelle",
    slug: "lucas-cantelle",
    login: "lucas",
    cargo: "socio" as const,
    ordem: 1,
  },
  {
    id: "alexandre-albertini",
    nome: "Xandy",
    slug: "alexandre-albertini",
    login: "alexandre",
    cargo: "barbeiro" as const,
    ordem: 2,
  },
  {
    id: "ryan-ferreira",
    nome: "Ryan",
    slug: "ryan-ferreira",
    login: "ryan",
    cargo: "socio" as const,
    ordem: 3,
  },
  {
    id: "peixoto",
    nome: "Peixoto",
    slug: "peixoto",
    login: "peixoto",
    cargo: "barbeiro" as const,
    ordem: 4,
  },
] as const;

type BarbeiroAutorizadoId = (typeof BARBEIROS_AUTORIZADOS)[number]["id"];

const BARBEIROS_AUTORIZADOS_MAP = new Map<BarbeiroAutorizadoId, (typeof BARBEIROS_AUTORIZADOS)[number]>(
  BARBEIROS_AUTORIZADOS.map((barbeiro) => [barbeiro.id, barbeiro])
);

function filtrarBarbeirosAutorizados(barbeiros: Barbeiro[]) {
  return barbeiros
    .filter((barbeiro) => BARBEIROS_AUTORIZADOS_MAP.has(barbeiro.id as BarbeiroAutorizadoId))
    .map((barbeiro) => {
      const autorizado = BARBEIROS_AUTORIZADOS_MAP.get(barbeiro.id as BarbeiroAutorizadoId)!;
      return {
        ...barbeiro,
        nome: autorizado.nome,
        slug: autorizado.slug,
        login: autorizado.login,
        cargo: autorizado.cargo,
        ordem: autorizado.ordem,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

async function loadBarbeirosFromDatabase() {
  const { data, error } = await supabase
    .from("barbeiros")
    .select("id, nome, slug, login, senha_hash, cargo, ativo, ordem, foto_url")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return filtrarBarbeirosAutorizados((data ?? []) as Barbeiro[]);
}

async function loadBarbeirosStrict() {
  return loadBarbeirosFromDatabase();
}

export async function listActiveBarbeiros() {
  const barbeiros = await loadBarbeirosFromDatabase();
  return barbeiros.filter((barbeiro) => barbeiro.ativo);
}

export async function listAllBarbeiros() {
  return loadBarbeirosFromDatabase();
}

export async function findBarbeiroByLogin(login?: string | null) {
  const normalized = String(login ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const barbeiros = await loadBarbeirosStrict();
  return barbeiros.find((barbeiro) => barbeiro.login.toLowerCase() === normalized) ?? null;
}

export async function findBarbeiroById(id?: string | null) {
  const normalized = String(id ?? "").trim();

  if (!normalized) {
    return null;
  }

  const barbeiros = await loadBarbeirosStrict();
  return barbeiros.find((barbeiro) => barbeiro.id === normalized) ?? null;
}

export async function authenticateBarbeiro(login: string, senha: string) {
  const barbeiro = await findBarbeiroByLogin(login);

  if (!barbeiro || !barbeiro.ativo) {
    return null;
  }

  const { matches, upgradedHash } = await verifyPassword(senha, barbeiro.senha_hash);

  if (!matches) {
    return null;
  }

  if (upgradedHash) {
    await supabase
      .from("barbeiros")
      .update({ senha_hash: upgradedHash })
      .eq("id", barbeiro.id)
      .eq("senha_hash", barbeiro.senha_hash);
  }

  return barbeiro;
}
