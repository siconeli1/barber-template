import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { listarPlanosAtivos, type Plano } from "@/lib/planos";
import { projectAssinaturaPeriodo } from "@/lib/assinaturas";
import { supabase } from "@/lib/supabase";
import { getWhatsAppLink } from "@/lib/whatsapp";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const busca = String(searchParams.get("busca") ?? "").trim().toLowerCase();
    const planoId = String(searchParams.get("plano_id") ?? "").trim();
    const somenteComPlano = searchParams.get("com_plano") === "true";

    const [clientesRes, assinaturasRes, agendamentosRes, planos] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, telefone, created_at")
        .order("nome", { ascending: true }),
      supabase
        .from("assinaturas")
        .select("id, cliente_id, plano_id, status, tipo_renovacao, inicio_ciclo, fim_ciclo, proxima_renovacao")
        .eq("status", "ativo"),
      supabase
        .from("agendamentos")
        .select("cliente_id, data, hora_inicio")
        .not("cliente_id", "is", null)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false }),
      listarPlanosAtivos(),
    ]);

    if (clientesRes.error || assinaturasRes.error || agendamentosRes.error) {
      throw new Error(
        clientesRes.error?.message ||
        assinaturasRes.error?.message ||
        agendamentosRes.error?.message ||
        "Erro ao carregar clientes."
      );
    }

    const planoById = new Map((planos as Plano[]).map((item) => [item.id, item]));
    const assinaturaByCliente = new Map(
      (assinaturasRes.data ?? [])
        .map((item) => {
          const assinaturaAtual = projectAssinaturaPeriodo(item);
          if (!assinaturaAtual) {
            return null;
          }
          return [item.cliente_id, { ...item, ...assinaturaAtual }] as const;
        })
        .filter((item): item is readonly [string, NonNullable<typeof assinaturasRes.data>[number]] => Boolean(item))
    );

    const ultimaVisitaByCliente = new Map<string, string>();

    for (const agendamento of agendamentosRes.data ?? []) {
      const clienteIdAgendamento = agendamento.cliente_id;
      if (!clienteIdAgendamento || ultimaVisitaByCliente.has(clienteIdAgendamento)) {
        continue;
      }
      ultimaVisitaByCliente.set(clienteIdAgendamento, agendamento.data);
    }

    let clientes = (clientesRes.data ?? []).map((cliente) => {
      const assinatura = assinaturaByCliente.get(cliente.id);
      return {
        ...cliente,
        ultima_visita: ultimaVisitaByCliente.get(cliente.id) ?? null,
        plano_ativo: assinatura?.plano_id ?? null,
        plano_nome: assinatura?.plano_id ? planoById.get(assinatura.plano_id)?.nome ?? assinatura.plano_id : null,
        assinatura_id: assinatura?.id ?? null,
        vencimento: assinatura?.proxima_renovacao ?? null,
        whatsapp_link: getWhatsAppLink(cliente.telefone),
      };
    });

    if (busca) {
      clientes = clientes.filter(
        (cliente) =>
          cliente.nome.toLowerCase().includes(busca) || cliente.telefone.includes(busca)
      );
    }

    if (planoId) {
      clientes = clientes.filter((cliente) => cliente.plano_ativo === planoId);
    }

    if (somenteComPlano) {
      clientes = clientes.filter((cliente) => Boolean(cliente.plano_ativo));
    }

    return NextResponse.json({ clientes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar clientes.";
    return NextResponse.json({ erro: message }, { status: message === "Não autorizado" ? 401 : 500 });
  }
}
