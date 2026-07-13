import { NextResponse } from "next/server";
import { canAdminCancelAppointment, canCancelAppointment } from "@/lib/agendamento-rules";
import { supabase } from "@/lib/supabase";
import { getAdminSession, isSocioAdmin } from "@/lib/admin-auth";
import { liquidarCreditosDoAgendamento } from "@/lib/agendamento-planos";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");

    if (!id) {
      return NextResponse.json({ erro: "ID não informado." }, { status: 400 });
    }

    const adminSession = await getAdminSession();
    const isAdminRequest = Boolean(body?.admin) || Boolean(adminSession);

    // Telefone enviado pelo cliente para identificação
    const telefoneBruto = String(body?.telefone ?? "").trim();
    const telefoneCliente = telefoneBruto ? normalizePhone(telefoneBruto) : null;

    const { data: agendamento, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, barbeiro_id, celular_cliente, data, hora_inicio, hora_fim, cancelavel_ate, status, status_agendamento, status_atendimento, status_pagamento, origem_agendamento")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!agendamento) {
      return NextResponse.json({ erro: "Agendamento não encontrado." }, { status: 404 });
    }

    if (isAdminRequest) {
      if (!adminSession) {
        return NextResponse.json(
          { erro: "Sessão de administrador expirada. Faça login novamente." },
          { status: 401 }
        );
      }
      if (!isSocioAdmin(adminSession) && agendamento.barbeiro_id !== adminSession.barbeiro_id) {
        return NextResponse.json({ erro: "Não autorizado a cancelar este agendamento." }, { status: 403 });
      }
    } else if (telefoneCliente) {
      const telefoneCadastrado = normalizePhone(agendamento.celular_cliente ?? "");
      if (telefoneCadastrado !== telefoneCliente) {
        return NextResponse.json({ erro: "Não autorizado a cancelar este agendamento." }, { status: 403 });
      }
    } else {
      return NextResponse.json({ erro: "Identificação necessária para cancelar." }, { status: 401 });
    }

    const podeCancelar = adminSession ? canAdminCancelAppointment(agendamento) : canCancelAppointment(agendamento);

    if (!podeCancelar) {
      return NextResponse.json({ erro: "Este agendamento não pode mais ser cancelado." }, { status: 409 });
    }

    const { error } = await supabase
      .from("agendamentos")
      .update({
        status: "cancelado",
        status_agendamento: "cancelado",
        cancelado_em: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    await liquidarCreditosDoAgendamento(id, "devolucao_credito");

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor.";
    return NextResponse.json({ erro: message }, { status: 500 });
  }
}
