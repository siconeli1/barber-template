import { NextResponse } from "next/server";
import { isSocioAdmin, requireAdminSession } from "@/lib/admin-auth";
import { getFinanceSnapshot, getTodaySaoPauloIso, type FinancePeriod, type FinanceScope } from "@/lib/admin-finance";

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("periodo") ?? "dia") as FinancePeriod;
    const scope = (searchParams.get("escopo") ?? "meu") as FinanceScope;
    const anchorDate = searchParams.get("data") ?? getTodaySaoPauloIso();

    if (!["dia", "semana", "mes"].includes(period)) {
      return NextResponse.json({ erro: "Periodo invalido." }, { status: 400 });
    }

    if (!["meu", "geral"].includes(scope)) {
      return NextResponse.json({ erro: "Escopo invalido." }, { status: 400 });
    }

    if (scope === "geral" && !isSocioAdmin(session)) {
      return NextResponse.json({ erro: "Somente socios podem acessar a visao geral do financeiro." }, { status: 403 });
    }

    const snapshot = await getFinanceSnapshot({
      scope,
      period,
      anchorDate,
      barbeiroId: session.barbeiro_id,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar financeiro.";
    return NextResponse.json({ erro: message }, { status: message === "Não autorizado" ? 401 : 500 });
  }
}
