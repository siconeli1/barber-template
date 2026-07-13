import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookie,
} from "@/lib/admin-session";
import { authenticateBarbeiro } from "@/lib/barbeiros";
import {
  assertAdminLoginAllowed,
  clearAdminLoginFailures,
  registerAdminLoginFailure,
} from "@/lib/admin-login-rate-limit";

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const login = String(body?.login ?? "").trim();
  const senha = String(body?.password ?? "");
  const ip = getClientIp(req);

  if (!login || !senha) {
    return NextResponse.json({ erro: "Informe login e senha." }, { status: 400 });
  }

  try {
    await assertAdminLoginAllowed(login, ip);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Muitas tentativas de acesso.";
    return NextResponse.json({ erro: message }, { status: 429 });
  }

  const barbeiro = await authenticateBarbeiro(login, senha);

  if (!barbeiro) {
    await registerAdminLoginFailure(login, ip);
    return NextResponse.json({ erro: "Login ou senha invalidos." }, { status: 401 });
  }

  await clearAdminLoginFailures(login, ip);

  const token = await createAdminSessionCookie({
    barbeiro_id: barbeiro.id,
    barbeiro_login: barbeiro.login,
    barbeiro_nome: barbeiro.nome,
    barbeiro_cargo: barbeiro.cargo,
  });

  const response = NextResponse.json({
    ok: true,
    barbeiro: {
      id: barbeiro.id,
      nome: barbeiro.nome,
      login: barbeiro.login,
      slug: barbeiro.slug,
      cargo: barbeiro.cargo,
    },
  });

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
