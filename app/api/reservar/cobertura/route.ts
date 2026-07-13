import { NextResponse } from "next/server";
import { getClienteByTelefone, getTelefoneFromRequest } from "@/lib/customer-auth";
import { encontrarServicoAtivo } from "@/lib/servicos";
import { decidirCoberturaServicoNoPlano } from "@/lib/agendamento-planos";

export async function GET(request: Request) {
  try {
    const telefone = getTelefoneFromRequest(request);

    if (!telefone) {
      return NextResponse.json({ erro: "Informe o telefone." }, { status: 400 });
    }

    const cliente = await getClienteByTelefone(telefone);

    if (!cliente) {
      return NextResponse.json({ erro: "Cliente nao encontrado." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const servicoId = String(searchParams.get("servico_id") ?? "").trim();

    if (!servicoId) {
      return NextResponse.json({ erro: "servico_id obrigatorio." }, { status: 400 });
    }

    const servico = await encontrarServicoAtivo({ id: servicoId });
    if (!servico) {
      return NextResponse.json({ erro: "Servico nao encontrado." }, { status: 404 });
    }

    const cobertura = await decidirCoberturaServicoNoPlano(cliente.id, servico);
    return NextResponse.json({ cobertura });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao verificar cobertura do plano.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
