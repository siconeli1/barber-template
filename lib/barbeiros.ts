import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/security";
import barbershop from "@/barbershop.config";

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

// A lista de barbeiros autorizados vem do barbershop.config.ts e funciona
// como allowlist sobre as linhas da tabela `barbeiros`.
const BARBEIROS_AUTORIZADOS = barbershop.barbeiros.map((barbeiro, index) => ({
  id: barbeiro.id,
  nome: barbeiro.nome,
  slug: barbeiro.id,
  login: barbeiro.login,
  cargo: barbeiro.cargo,
  ordem: index + 1,
}));

const BARBEIROS_AUTORIZADOS_MAP = new Map(BARBEIROS_AUTORIZADOS.map((barbeiro) => [barbeiro.id, barbeiro]));

function filtrarBarbeirosAutorizados(barbeiros: Barbeiro[]) {
  return barbeiros
    .filter((barbeiro) => BARBEIROS_AUTORIZADOS_MAP.has(barbeiro.id))
    .map((barbeiro) => {
      const autorizado = BARBEIROS_AUTORIZADOS_MAP.get(barbeiro.id)!;
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
