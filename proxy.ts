import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/admin-session";

const PROTECTED_ADMIN_API_PREFIXES = [
  "/api/admin",
  "/api/admin-agenda",
  "/api/bloqueios",
  "/api/horarios-customizados",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = await verifyAdminSessionCookie(sessionCookie);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (
    PROTECTED_ADMIN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    pathname !== "/api/admin/login"
  ) {
    if (!session) {
      return NextResponse.json({ erro: "Nao autorizado" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/admin-agenda",
    "/api/bloqueios/:path*",
    "/api/horarios-customizados",
  ],
};
