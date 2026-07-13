import { NextResponse } from "next/server";
import { listarServicosAtivos } from "@/lib/servicos";

export async function GET() {
  try {
    const servicos = await listarServicosAtivos();
    return NextResponse.json({ servicos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar serviços.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
