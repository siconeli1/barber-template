import { NextResponse } from "next/server";
import { isSocioAdmin, requireAdminSession } from "@/lib/admin-auth";
import {
  atualizarObservacoesAssinatura,
  buscarAssinaturaAtiva,
  cancelarAssinatura,
  listarMovimentacoesCliente,
} from "@/lib/assinaturas";
import { buscarPlanoPorId } from "@/lib/planos";
import { supabase } from "@/lib/supabase";
import { getWhatsAppLink } from "@/lib/whatsapp";

function getIdFromRequest(request: Request) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const clienteId = getIdFromRequest(request);

    const [clienteRes, reservasRes, financeiroRes, historicoTelefoneRes] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, created_at, updated_at").eq("id", clienteId).maybeSingle(),
      supabase.from("agendamentos").select("*").eq("cliente_id", clienteId).order("data", { ascending: false }).order("hora_inicio", { ascending: false }),
      supabase.from("financeiro_lancamentos").select("*").eq("cliente_id", clienteId).order("competencia", { ascending: false }),
      supabase.from("clientes_telefone_historico").select("*").eq("cliente_id", clienteId).order("alterado_em", { ascending: false }),
    ]);

    if (clienteRes.error || reservasRes.error || financeiroRes.error || historicoTelefoneRes.error) {
      throw new Error(clienteRes.error?.message || reservasRes.error?.message || financeiroRes.error?.message || historicoTelefoneRes.error?.message || "Erro ao carregar perfil do cliente.");
    }

    if (!clienteRes.data) {
      return NextResponse.json({ erro: "Cliente nao encontrado." }, { status: 404 });
    }

    const assinatura = await buscarAssinaturaAtiva(clienteId);
    const plano = assinatura ? await buscarPlanoPorId(assinatura.plano_id) : null;
    const movimentacoes = await listarMovimentacoesCliente(clienteId);
    const reservas = reservasRes.data ?? [];

    const reservasPeriodo = assinatura
      ? reservas.filter((item) => item.data >= assinatura.inicio_ciclo && item.data <= assinatura.fim_ciclo)
      : [];
    const faltasPeriodo = reservasPeriodo.filter((item) => item.status_agendamento === "no_show").length;
    const cancelamentosPeriodo = reservasPeriodo.filter((item) => item.status_agendamento === "cancelado").length;

    return NextResponse.json({
      cliente: {
        ...clienteRes.data,
        whatsapp_link: getWhatsAppLink(clienteRes.data.telefone),
      },
      assinatura,
      plano,
      reservas,
      reservas_periodo: reservasPeriodo,
      faltas_periodo: faltasPeriodo,
      cancelamentos_periodo: cancelamentosPeriodo,
      financeiro: financeiroRes.data ?? [],
      historico_telefone: historicoTelefoneRes.data ?? [],
      historico_uso: movimentacoes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar perfil do cliente.";
    return NextResponse.json({ erro: message }, { status: message === "Não autorizado" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    const clienteId = getIdFromRequest(request);
    const body = await request.json();

    if (body?.acao === "cancelar_plano") {
      if (!body?.assinatura_id) {
        return NextResponse.json({ erro: "assinatura_id obrigatorio." }, { status: 400 });
      }

      const assinatura = await cancelarAssinatura(String(body.assinatura_id));
      return NextResponse.json({ assinatura });
    }

    if (body?.acao === "atualizar_observacoes_assinatura") {
      if (!body?.assinatura_id) {
        return NextResponse.json({ erro: "assinatura_id obrigatorio." }, { status: 400 });
      }

      const assinatura = await atualizarObservacoesAssinatura(String(body.assinatura_id), body.observacoes ? String(body.observacoes) : null);
      return NextResponse.json({ assinatura });
    }

    const patch: Record<string, string> = {};
    if (body?.nome) patch.nome = String(body.nome).trim();
    if (body?.telefone) patch.telefone = String(body.telefone).replace(/\D/g, "");

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ erro: "Nenhuma alteração válida foi enviada." }, { status: 400 });
    }

    if (!isSocioAdmin(session)) {
      return NextResponse.json({ erro: "Somente socios podem editar dados do cliente." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", clienteId)
      .select("id, nome, telefone, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ cliente: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar cliente.";
    return NextResponse.json(
      { erro: message },
      {
        status:
          message === "Não autorizado"
            ? 401
            : message.includes("Não é possível cancelar o plano com créditos reservados")
              ? 409
              : 500,
      }
    );
  }
}
