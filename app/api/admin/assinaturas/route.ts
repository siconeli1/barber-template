import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  aplicarTrocaImediata,
  atualizarObservacoesAssinatura,
  buscarAssinaturaAtiva,
  criarAssinatura,
  listarNotificacoesAssinatura,
  projectAssinaturaPeriodo,
  registrarUsoManualPlano,
  renovarAssinatura,
} from "@/lib/assinaturas";
import { buscarPlanoPorId, listarPlanosAtivos } from "@/lib/planos";
import { supabase } from "@/lib/supabase";

function getClienteRelation(
  relation: { id?: string; nome?: string; telefone?: string } | { id?: string; nome?: string; telefone?: string }[] | null | undefined
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
}

type AssinanteRow = {
  id: string;
  cliente_id: string;
  plano_id: string;
  status: "ativo" | "cancelado" | "expirado";
  tipo_renovacao: "manual" | "automatica";
  inicio_ciclo: string;
  fim_ciclo: string;
  proxima_renovacao: string;
  observacoes_internas?: string | null;
  clientes?: { id?: string; nome?: string; telefone?: string } | { id?: string; nome?: string; telefone?: string }[] | null;
};

function getErrorStatus(message: string) {
  if (message === "Não autorizado") return 401;
  if (
    message.includes("obrigatorio") ||
    message.includes("YYYY-MM-DD") ||
    message.includes("fim_ciclo")
  ) {
    return 400;
  }
  if (
    message.includes("ja possui um plano ativo") ||
    message.includes("Não é possível cancelar o plano com créditos reservados") ||
    message.includes("alterados por outra operacao")
  ) {
    return 409;
  }
  return 500;
}

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const busca = String(searchParams.get("busca") ?? "").trim().toLowerCase();
    const planoId = String(searchParams.get("plano_id") ?? "").trim();
    const vencimento = String(searchParams.get("vencimento") ?? "todos").trim();

    const { hoje, notificacoes, vencendoHoje } = await listarNotificacoesAssinatura();
    const planos = await listarPlanosAtivos();

    let query = supabase
      .from("assinaturas")
      .select("*, clientes(id, nome, telefone)")
      .eq("status", "ativo")
      .order("proxima_renovacao", { ascending: true });

    if (planoId) {
      query = query.eq("plano_id", planoId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const limiteVencimentoIso =
      vencimento === "proximos_7"
        ? (() => {
            const limite = new Date(`${hoje}T00:00:00`);
            limite.setDate(limite.getDate() + 7);
            return `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
          })()
        : null;

    const rawAssinantes = ((data ?? []) as unknown as AssinanteRow[])
      .map((item) => {
        const assinaturaAtual = projectAssinaturaPeriodo(item);
        if (!assinaturaAtual) {
          return null;
        }
        return {
          ...item,
          ...assinaturaAtual,
        };
      })
      .filter((item): item is AssinanteRow => Boolean(item))
      .filter((item) => {
        if (!busca) return true;
        const cliente = getClienteRelation(item.clientes);
        const nome = String(cliente?.nome ?? "").toLowerCase();
        const telefone = String(cliente?.telefone ?? "");
        return nome.includes(busca) || telefone.includes(busca);
      })
      .filter((item) => {
        if (vencimento === "hoje") {
          return item.proxima_renovacao === hoje;
        }
        if (vencimento === "proximos_7" && limiteVencimentoIso) {
          return item.proxima_renovacao <= limiteVencimentoIso;
        }
        return true;
      })
      .sort((a, b) => a.proxima_renovacao.localeCompare(b.proxima_renovacao));

    const assinantes = rawAssinantes.map((item) => ({
      ...item,
      clientes: getClienteRelation(item.clientes),
      plano_nome: planos.find((plano) => plano.id === item.plano_id)?.nome ?? item.plano_id,
    }));

    return NextResponse.json({
      hoje,
      filtros: {
        busca,
        plano_id: planoId || null,
        vencimento,
      },
      assinantes,
      notificacoes_vencimento: notificacoes,
      vencendo_hoje: vencendoHoje,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar assinaturas.";
    return NextResponse.json({ erro: message }, { status: message === "Não autorizado" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = await request.json();
    const acao = String(body?.acao ?? "");

    if (!acao) {
      return NextResponse.json({ erro: "Acao obrigatoria." }, { status: 400 });
    }

    if (acao === "adicionar_plano") {
      const clienteId = String(body?.cliente_id ?? "").trim();
      const planoId = String(body?.plano_id ?? "").trim();
      const inicioCiclo = String(body?.inicio_ciclo ?? "").trim();
      const fimCiclo = String(body?.fim_ciclo ?? "").trim();

      if (!clienteId || !planoId || !inicioCiclo || !fimCiclo) {
        return NextResponse.json({ erro: "cliente_id, plano_id, inicio_ciclo e fim_ciclo sao obrigatorios." }, { status: 400 });
      }

      const plano = await buscarPlanoPorId(String(body.plano_id));
      if (!plano) {
        return NextResponse.json({ erro: "Plano nao encontrado." }, { status: 404 });
      }

      const assinatura = await criarAssinatura({
        clienteId,
        plano,
        tipoRenovacao: body.tipo_renovacao === "automatica" ? "automatica" : "manual",
        inicioCiclo,
        fimCiclo,
        observacoes: body.observacoes ? String(body.observacoes) : undefined,
      });

      return NextResponse.json({ assinatura });
    }

    if (acao === "renovar_plano") {
      const assinaturaId = String(body?.assinatura_id ?? "").trim();
      const planoId = String(body?.plano_id ?? "").trim();
      const inicioCiclo = String(body?.inicio_ciclo ?? "").trim();
      const fimCiclo = String(body?.fim_ciclo ?? "").trim();

      if (!assinaturaId || !planoId || !inicioCiclo || !fimCiclo) {
        return NextResponse.json({ erro: "assinatura_id, plano_id, inicio_ciclo e fim_ciclo sao obrigatorios." }, { status: 400 });
      }

      const plano = await buscarPlanoPorId(String(body.plano_id));
      if (!plano) {
        return NextResponse.json({ erro: "Plano nao encontrado." }, { status: 404 });
      }

      const assinatura = await renovarAssinatura(assinaturaId, plano, inicioCiclo, fimCiclo);

      return NextResponse.json({ assinatura });
    }

    if (acao === "troca_imediata") {
      const assinaturaId = String(body?.assinatura_id ?? "").trim();
      const planoId = String(body?.plano_id ?? "").trim();

      if (!assinaturaId || !planoId) {
        return NextResponse.json({ erro: "assinatura_id e plano_id sao obrigatorios." }, { status: 400 });
      }

      const plano = await buscarPlanoPorId(String(body.plano_id));
      if (!plano) {
        return NextResponse.json({ erro: "Plano nao encontrado." }, { status: 404 });
      }

      const assinatura = await aplicarTrocaImediata(assinaturaId, plano);
      return NextResponse.json({ assinatura });
    }

    if (acao === "registrar_uso_manual") {
      const clienteId = String(body?.cliente_id ?? "").trim();
      const categoria = String(body?.categoria ?? "").trim();
      const quantidade = Number(body?.quantidade ?? 1);

      if (!clienteId) {
        return NextResponse.json({ erro: "cliente_id obrigatorio." }, { status: 400 });
      }

      if (!["corte", "barba", "sobrancelha"].includes(categoria)) {
        return NextResponse.json({ erro: "Categoria invalida para uso manual." }, { status: 400 });
      }

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return NextResponse.json({ erro: "Quantidade invalida para uso manual." }, { status: 400 });
      }

      const assinatura = await buscarAssinaturaAtiva(clienteId);
      if (!assinatura) {
        return NextResponse.json({ erro: "Cliente sem assinatura ativa." }, { status: 409 });
      }

      await registrarUsoManualPlano({
        assinaturaId: assinatura.id,
        clienteId: assinatura.cliente_id,
        categoria: categoria as "corte" | "barba" | "sobrancelha",
        quantidade,
        observacao: body.observacao ? String(body.observacao) : "Uso manual registrado pelo admin",
      });

      return NextResponse.json({ ok: true });
    }

    if (acao === "atualizar_observacoes") {
      const assinaturaId = String(body.assinatura_id ?? "");
      if (!assinaturaId) {
        return NextResponse.json({ erro: "assinatura_id obrigatorio." }, { status: 400 });
      }

      const assinatura = await atualizarObservacoesAssinatura(assinaturaId, body.observacoes ? String(body.observacoes) : null);
      return NextResponse.json({ assinatura });
    }

    return NextResponse.json({ erro: "Acao nao suportada." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar assinatura.";
    return NextResponse.json({ erro: message }, { status: getErrorStatus(message) });
  }
}
