import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    barbeiro: {
      id: session.barbeiro_id,
      nome: session.barbeiro_nome,
      login: session.barbeiro_login,
      cargo: session.barbeiro_cargo,
    },
  });
}
