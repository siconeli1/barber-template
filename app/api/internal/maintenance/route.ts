import { NextResponse } from "next/server";
import { reconcileAgendamentosLifecycle } from "@/lib/agendamento-lifecycle";
import { sincronizarAssinaturas } from "@/lib/assinaturas";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.MAINTENANCE_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    const [assinaturasSincronizadas, agendamentosConciliados] = await Promise.all([
      sincronizarAssinaturas(),
      reconcileAgendamentosLifecycle(),
    ]);

    return NextResponse.json({
      ok: true,
      assinaturas_sincronizadas: assinaturasSincronizadas,
      agendamentos_conciliados: agendamentosConciliados,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar manutencao.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
