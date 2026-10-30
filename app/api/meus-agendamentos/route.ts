import { NextResponse } from "next/server";
import { projectAutoClosedAgendamentos } from "@/lib/agendamento";
import { canCancelAppointment } from "@/lib/agendamento-rules";
import { supabase } from "@/lib/supabase";
import { getClienteByTelefone, getTelefoneFromRequest } from "@/lib/customer-auth";
import { normalizePhone } from "@/lib/phone";

export async function GET(req: Request) {
  try {
    const telefone = getTelefoneFromRequest(req);

    if (!telefone) {
      return NextResponse.json({ erro: "Informe o telefone para consultar agendamentos." }, { status: 400 });
    }

    const telefoneNormalizado = normalizePhone(telefone);
    const cliente = await getClienteByTelefone(telefoneNormalizado);

    if (!cliente) {
      return NextResponse.json({ profile_exists: false, agendamentos: [] });
    }

    const { data: agendamentosRaw, error } = await supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, valor_final, status, status_agendamento, status_atendimento, status_pagamento, cancelavel_ate, barbeiro_id, barbeiros(nome)")
      .eq("celular_cliente", telefoneNormalizado)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const data = projectAutoClosedAgendamentos(agendamentosRaw || []);

    // ?formato=compacto: so os agendamentos futuros, com o minimo que o agente do Telegram precisa.
    if (new URL(req.url).searchParams.get("formato") === "compacto") {
      const futuros = data.filter(
        (item) =>
          item.status !== "cancelado" &&
          item.status_agendamento !== "cancelado" &&
          item.status_agendamento !== "no_show" &&
          item.status_atendimento !== "concluido"
      );

      return NextResponse.json({
        agendamentos: futuros.map((item) => ({
          id: item.id,
          data: item.data,
          hora_inicio: String(item.hora_inicio).slice(0, 5),
          servico: item.servico_nome,
          pode_cancelar: canCancelAppointment(item),
        })),
      });
    }

    return NextResponse.json({ profile_exists: true, agendamentos: data || [] });
  } catch {
    return NextResponse.json({ erro: "Erro interno do servidor" }, { status: 500 });
  }
}
