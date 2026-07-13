import { NextResponse } from "next/server";
import { requireSocioSession } from "@/lib/admin-auth";
import { listActiveBarbeiros } from "@/lib/barbeiros";
import { projectAutoClosedAgendamentos } from "@/lib/agendamento";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    await requireSocioSession();
    const { searchParams } = new URL(req.url);
    const data = String(searchParams.get("data") ?? "").trim();

    if (!data) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 });
    }

    const barbeiros = await listActiveBarbeiros();
    const barbeiroIds = barbeiros.map((barbeiro) => barbeiro.id);

    if (barbeiroIds.length === 0) {
      return NextResponse.json({ barbeiros: [], agenda: [], data });
    }

    const [agendamentosRes, customRes] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("id, barbeiro_id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, status, status_agendamento, status_atendimento, status_pagamento, valor_tabela, desconto, acrescimo, valor_final, forma_pagamento, origem_agendamento, observacoes, concluido_em, cancelado_em, tipo_cobranca")
        .eq("data", data)
        .in("barbeiro_id", barbeiroIds)
        .order("hora_inicio", { ascending: true }),
      supabase
        .from("horarios_customizados")
        .select("id, barbeiro_id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente")
        .eq("data", data)
        .in("barbeiro_id", barbeiroIds)
        .order("hora_inicio", { ascending: true }),
    ]);

    if (agendamentosRes.error) {
      return NextResponse.json({ erro: agendamentosRes.error.message }, { status: 500 });
    }

    if (customRes.error) {
      return NextResponse.json({ erro: customRes.error.message }, { status: 500 });
    }

    const agendaProjetada = projectAutoClosedAgendamentos(agendamentosRes.data ?? []);
    const agendaCustom = (customRes.data ?? []).map((item) => ({
      id: item.id,
      barbeiro_id: item.barbeiro_id,
      data: item.data,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      nome_cliente: item.nome_cliente || "Horário reservado",
      celular_cliente: item.celular_cliente || "",
      servico_nome: "Horário personalizado",
      servico_preco: 0,
      status: "ativo",
      status_agendamento: "confirmado",
      status_atendimento: "concluido",
      status_pagamento: "pendente",
      valor_tabela: 0,
      desconto: 0,
      acrescimo: 0,
      valor_final: 0,
      forma_pagamento: null,
      origem_agendamento: "horario_customizado",
      observacoes: null,
      concluido_em: null,
      cancelado_em: null,
      tipo_cobranca: "avulso",
      origem: "horario_customizado",
    }));

    return NextResponse.json({
      data,
      barbeiros: barbeiros.map((barbeiro) => ({
        id: barbeiro.id,
        nome: barbeiro.nome,
        ordem: barbeiro.ordem,
      })),
      agenda: [...agendaProjetada, ...agendaCustom].sort((a, b) => {
        if (a.barbeiro_id !== b.barbeiro_id) {
          return a.barbeiro_id.localeCompare(b.barbeiro_id);
        }
        return `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`);
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao carregar agenda geral.";
    const status = message === "Não autorizado" ? 401 : message === "Sem permissão" ? 403 : 500;
    return NextResponse.json({ erro: message }, { status });
  }
}
