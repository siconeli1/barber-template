import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/admin-session";
import { findBarbeiroById } from "@/lib/barbeiros";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionCookie(token);
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    throw new Error("Não autorizado");
  }

  return session;
}

export function isSocioAdmin(
  session: { barbeiro_cargo?: string } | null | undefined
) {
  return session?.barbeiro_cargo === "socio";
}

export async function requireSocioSession() {
  const session = await requireAdminSession();

  if (!isSocioAdmin(session)) {
    throw new Error("Sem permissao");
  }

  return session;
}

export async function resolveAdminBarbeiroScope(
  session: { barbeiro_id: string; barbeiro_cargo?: string },
  requestedBarbeiroId?: string | null
) {
  const normalized = String(requestedBarbeiroId ?? "").trim();

  if (!normalized || normalized === session.barbeiro_id) {
    return session.barbeiro_id;
  }

  if (!isSocioAdmin(session)) {
    throw new Error("Sem permissao");
  }

  const target = await findBarbeiroById(normalized);

  if (!target || !target.ativo) {
    throw new Error("Barbeiro nao encontrado.");
  }

  return target.id;
}
