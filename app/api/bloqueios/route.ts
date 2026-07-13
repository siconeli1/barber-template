import { NextResponse } from "next/server";
import { overlaps, parseTimeToMinutes } from "@/lib/agenda-conflicts";
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

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, searchParams.get("barbeiro_id"));

    if (!data) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 });
    }

    const { data: bloqueios, error } = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("barbeiro_id", targetBarbeiroId)
      .eq("data", data)
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

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, body?.barbeiro_id ? String(body.barbeiro_id) : null);
    const { data, hora_inicio, hora_fim, dia_inteiro, motivo, tipo_bloqueio } = body;

    if (!data) {
      return NextResponse.json({ erro: "A data e obrigatoria." }, { status: 400 });
    }

    if (tipo_bloqueio === "horario") {
      if (!hora_inicio || !hora_fim) {
        return NextResponse.json({ erro: "Hora de inicio e hora de fim sao obrigatorias." }, { status: 400 });
      }

      if (hora_inicio >= hora_fim) {
        return NextResponse.json({ erro: "Hora de fim deve ser apos hora de inicio." }, { status: 400 });
      }
    }

    const [
      { data: agendamentos, error: agendamentosError },
      { data: horariosCustomizados, error: horariosError },
      { data: bloqueiosExistentes, error: bloqueiosError },
    ] =
      await Promise.all([
        supabase
          .from("agendamentos")
          .select("id, nome_cliente, celular_cliente, hora_inicio, hora_fim, status, status_agendamento")
          .eq("barbeiro_id", targetBarbeiroId)
          .eq("data", data),
        supabase
          .from("horarios_customizados")
          .select("id, nome_cliente, celular_cliente, hora_inicio, hora_fim")
          .eq("barbeiro_id", targetBarbeiroId)
          .eq("data", data),
        supabase
          .from("bloqueios_agenda")
          .select("id, hora_inicio, hora_fim, dia_inteiro, tipo_bloqueio")
          .eq("barbeiro_id", targetBarbeiroId)
          .eq("data", data),
      ]);

    if (agendamentosError || horariosError || bloqueiosError) {
      return NextResponse.json({ erro: agendamentosError?.message || horariosError?.message || bloqueiosError?.message }, { status: 500 });
    }

    const bloqueios = bloqueiosExistentes || [];
    const hasBloqueioDiaInteiro = bloqueios.some((item) => item.dia_inteiro || item.tipo_bloqueio === "dia_inteiro");
    const hasNaoAceitarMais = bloqueios.some((item) => item.tipo_bloqueio === "nao_aceitar_mais");

    if (tipo_bloqueio === "dia_inteiro") {
      if (bloqueios.length > 0) {
        return NextResponse.json(
          {
            erro: "Ja existe bloqueio cadastrado nessa data. Remova ou ajuste os bloqueios atuais antes de bloquear o dia inteiro.",
          },
          { status: 409 }
        );
      }

      const ocupacoesAtivas = [
        ...((agendamentos || [])
          .filter((agendamento) =>
            agendamento.status_agendamento
              ? agendamento.status_agendamento !== "cancelado"
              : agendamento.status === "ativo"
          )
          .map((agendamento) => ({
            id: agendamento.id,
            nome_cliente: agendamento.nome_cliente,
            celular_cliente: agendamento.celular_cliente,
            hora_inicio: agendamento.hora_inicio,
            hora_fim: agendamento.hora_fim,
            origem: "agendamento",
          }))),
        ...((horariosCustomizados || []).map((horario) => ({
          id: horario.id,
          nome_cliente: horario.nome_cliente,
          celular_cliente: horario.celular_cliente,
          hora_inicio: horario.hora_inicio,
          hora_fim: horario.hora_fim,
          origem: "horario_customizado",
        }))),
      ];

      if (ocupacoesAtivas.length > 0) {
        return NextResponse.json(
          {
            erro: `Não é possível bloquear o dia inteiro. Existem ${ocupacoesAtivas.length} horário(s) ocupados nesta data.`,
            agendamentos: ocupacoesAtivas,
          },
          { status: 400 }
        );
      }
    }

    if (tipo_bloqueio === "horario") {
      if (hasBloqueioDiaInteiro) {
        return NextResponse.json({ erro: "Ja existe um bloqueio de dia inteiro nessa data." }, { status: 409 });
      }

      const inicio = parseTimeToMinutes(hora_inicio);
      const fim = parseTimeToMinutes(hora_fim);

      const conflitoAgendamento = (agendamentos || [])
        .filter((agendamento) =>
          agendamento.status_agendamento
            ? agendamento.status_agendamento !== "cancelado"
            : agendamento.status === "ativo"
        )
        .find((agendamento) =>
          overlaps(
            inicio,
            fim,
            parseTimeToMinutes(String(agendamento.hora_inicio)),
            parseTimeToMinutes(String(agendamento.hora_fim))
          )
        );

      if (conflitoAgendamento) {
        return NextResponse.json({ erro: "Bloqueio conflita com um agendamento existente." }, { status: 409 });
      }

      const conflitoHorarioCustomizado = (horariosCustomizados || []).find((horario) =>
        overlaps(
          inicio,
          fim,
          parseTimeToMinutes(String(horario.hora_inicio)),
          parseTimeToMinutes(String(horario.hora_fim))
        )
      );

      if (conflitoHorarioCustomizado) {
        return NextResponse.json({ erro: "Bloqueio conflita com um horário personalizado." }, { status: 409 });
      }

      const conflitoBloqueio = bloqueios.find((bloqueio) => {
        if (bloqueio.dia_inteiro || bloqueio.tipo_bloqueio !== "horario" || !bloqueio.hora_inicio || !bloqueio.hora_fim) {
          return false;
        }

        return overlaps(
          inicio,
          fim,
          parseTimeToMinutes(String(bloqueio.hora_inicio)),
          parseTimeToMinutes(String(bloqueio.hora_fim))
        );
      });

      if (conflitoBloqueio) {
        return NextResponse.json({ erro: "Ja existe outro bloqueio nesse intervalo." }, { status: 409 });
      }
    }

    if (tipo_bloqueio === "nao_aceitar_mais") {
      if (hasBloqueioDiaInteiro) {
        return NextResponse.json({ erro: "Ja existe um bloqueio de dia inteiro nessa data." }, { status: 409 });
      }

      if (hasNaoAceitarMais) {
        return NextResponse.json({ erro: "Essa data já está marcada para não aceitar novos horários." }, { status: 409 });
      }
    }

    const { data: bloqueio, error } = await supabase
      .from("bloqueios_agenda")
      .insert([
        {
          barbeiro_id: targetBarbeiroId,
          data,
          hora_inicio: dia_inteiro ? null : hora_inicio || null,
          hora_fim: dia_inteiro ? null : hora_fim || null,
          dia_inteiro: !!dia_inteiro,
          motivo: motivo || null,
          tipo_bloqueio: tipo_bloqueio || "horario",
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json(bloqueio);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar bloqueio.";
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
      return NextResponse.json({ erro: "ID do bloqueio obrigatorio." }, { status: 400 });
    }

    const { data: bloqueioAtual, error: loadError } = await supabase
      .from("bloqueios_agenda")
      .select("id, barbeiro_id")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!bloqueioAtual) {
      return NextResponse.json({ erro: "Bloqueio nao encontrado." }, { status: 404 });
    }

    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, bloqueioAtual.barbeiro_id);

    const { error } = await supabase
      .from("bloqueios_agenda")
      .delete()
      .eq("id", id)
      .eq("barbeiro_id", targetBarbeiroId);

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao deletar bloqueio.";
    const status = getRouteErrorStatus(message);
    return NextResponse.json({ erro: message }, { status });
  }
}
