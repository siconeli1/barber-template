import { NextResponse } from "next/server";
import { getClienteByTelefone, findOrCreateCliente, getTelefoneFromRequest } from "@/lib/customer-auth";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

// GET /api/client/profile?telefone=xxx
export async function GET(request: Request) {
  try {
    const telefone = getTelefoneFromRequest(request);

    if (!telefone) {
      return NextResponse.json({ erro: "Informe o telefone." }, { status: 400 });
    }

    const profile = await getClienteByTelefone(telefone);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar perfil.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}

// POST /api/client/profile — encontra ou cria cliente por telefone
// Body: { telefone, nome? }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const nome = String(body?.nome ?? "").trim();
    const telefone = normalizePhone(String(body?.telefone ?? ""));

    if (!telefone) {
      return NextResponse.json({ erro: "Informe o telefone." }, { status: 400 });
    }

    if (!isValidPhone(telefone)) {
      return NextResponse.json({ erro: "Informe um telefone valido com DDD." }, { status: 400 });
    }

    // Se o cliente já existe, retorna sem precisar do nome
    const existente = await getClienteByTelefone(telefone);
    if (existente) {
      return NextResponse.json({ profile: existente });
    }

    // Novo cliente: nome é obrigatório
    if (!nome) {
      return NextResponse.json({ novo_cliente: true, erro: "Informe seu nome para criar o cadastro." }, { status: 422 });
    }

    const profile = await findOrCreateCliente(nome, telefone);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar perfil.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}

// PATCH /api/client/profile — atualiza nome/telefone
// Body: { telefone_atual, nome?, telefone_novo? }
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const telefoneAtual = normalizePhone(String(body?.telefone_atual ?? ""));

    if (!telefoneAtual) {
      return NextResponse.json({ erro: "Informe o telefone atual para identificacao." }, { status: 400 });
    }

    const existing = await getClienteByTelefone(telefoneAtual);
    if (!existing) {
      return NextResponse.json({ erro: "Cliente nao encontrado." }, { status: 404 });
    }

    const patch: Record<string, string> = {};
    if (body?.nome) patch.nome = String(body.nome).trim();
    if (body?.telefone_novo) {
      const novoTel = normalizePhone(String(body.telefone_novo));
      if (!isValidPhone(novoTel)) {
        return NextResponse.json({ erro: "Informe um telefone valido com DDD." }, { status: 400 });
      }
      patch.telefone = novoTel;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ erro: "Nenhuma alteracao valida foi enviada." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar perfil.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
