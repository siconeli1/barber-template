import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession, resolveAdminBarbeiroScope } from "@/lib/admin-auth";

function getRouteErrorStatus(message: string) {
  if (message === "Não autorizado") {
    return 401;
  }
  if (message === "Sem permissao") {
    return 403;
  }
  if (message === "Barbeiro nao encontrado.") {
    return 404;
  }
  return 500;
}

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, searchParams.get("barbeiro_id"));
    const { data: bloqueios, error } = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("barbeiro_id", targetBarbeiroId)
      .order("data", { ascending: false })
      .order("hora_inicio", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ bloqueios: bloqueios || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao listar bloqueios.";
    const status = getRouteErrorStatus(message);
    return NextResponse.json({ erro: message }, { status });
  }
}
