import { NextResponse } from "next/server";
import { listActiveBarbeiros } from "@/lib/barbeiros";

export async function GET() {
  try {
    const barbeiros = await listActiveBarbeiros();

    return NextResponse.json({
      barbeiros: barbeiros.map((barbeiro) => ({
        id: barbeiro.id,
        nome: barbeiro.nome,
        slug: barbeiro.slug,
        ordem: barbeiro.ordem,
        foto_url: barbeiro.foto_url,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar barbeiros";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
