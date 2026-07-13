import { NextResponse } from "next/server";
import { listarPlanosAtivos } from "@/lib/planos";

export async function GET() {
  try {
    const planos = await listarPlanosAtivos();
    return NextResponse.json({ planos });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Erro ao carregar planos." }, { status: 500 });
  }
}
