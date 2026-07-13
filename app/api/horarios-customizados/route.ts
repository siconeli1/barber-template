import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBusyIntervals, overlaps, parseTimeToMinutes } from "@/lib/agenda-conflicts";
import { normalizePhone } from "@/lib/phone";
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

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, searchParams.get("barbeiro_id"));

    if (!data) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 });
    }

    const { data: horarios, error } = await supabase
      .from("horarios_customizados")
      .select("*")
      .eq("barbeiro_id", targetBarbeiroId)
      .eq("data", data)
      .order("hora_inicio", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ horarios: horarios || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao listar horários.";
    const status = getRouteErrorStatus(message);
    return NextResponse.json({ erro: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, body?.barbeiro_id ? String(body.barbeiro_id) : null);
    const { data, hora_inicio, hora_fim, nome_cliente, celular_cliente } = body;

    if (!data || !hora_inicio || !hora_fim) {
      return NextResponse.json({ erro: "Data, hora de inicio e hora de fim sao obrigatorias." }, { status: 400 });
    }

    if (!nome_cliente) {
      return NextResponse.json({ erro: "Nome do cliente e obrigatorio." }, { status: 400 });
    }

    if (hora_inicio >= hora_fim) {
      return NextResponse.json({ erro: "Hora de fim deve ser apos hora de inicio." }, { status: 400 });
    }

    const inicio = parseTimeToMinutes(hora_inicio);
    const fim = parseTimeToMinutes(hora_fim);

    const busyState = await getBusyIntervals(data, targetBarbeiroId);
    if (busyState.bloqueioDiaInteiro) {
      return NextResponse.json({ erro: "Existe um bloqueio de dia inteiro nessa data." }, { status: 409 });
    }

    if (busyState.naoAceitarMais) {
      return NextResponse.json({ erro: "Essa data está marcada para não aceitar novos horários." }, { status: 409 });
    }

    const conflito = busyState.intervalos.find((intervalo) =>
      overlaps(inicio, fim, intervalo.inicio, intervalo.fim)
    );

    if (conflito) {
      const erroConflito =
        conflito.tipo === "agendamento"
          ? "Existe conflito com um agendamento existente."
          : conflito.tipo === "horario_customizado"
            ? "Existe conflito com outro horário personalizado."
            : "Existe conflito com um bloqueio da agenda.";
      return NextResponse.json({ erro: erroConflito }, { status: 409 });
    }

    const { data: horario, error } = await supabase
      .from("horarios_customizados")
      .insert([
        {
          barbeiro_id: targetBarbeiroId,
          data,
          hora_inicio,
          hora_fim,
          nome_cliente,
          celular_cliente: normalizePhone(celular_cliente) || null,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json(horario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar horário.";
    const status = getRouteErrorStatus(message);
    return NextResponse.json({ erro: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ erro: "ID do horário obrigatório." }, { status: 400 });
    }

    const { data: horarioAtual, error: loadError } = await supabase
      .from("horarios_customizados")
      .select("id, barbeiro_id")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!horarioAtual) {
      return NextResponse.json({ erro: "Horário não encontrado." }, { status: 404 });
    }

    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, horarioAtual.barbeiro_id);

    const { error } = await supabase
      .from("horarios_customizados")
      .delete()
      .eq("id", id)
      .eq("barbeiro_id", targetBarbeiroId);

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao deletar horário.";
    const status = getRouteErrorStatus(message);
    return NextResponse.json({ erro: message }, { status });
  }
}
