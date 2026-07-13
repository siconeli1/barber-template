import { supabase } from "@/lib/supabase";
import type { Plano } from "@/lib/planos";
import { buscarPlanoPorId } from "@/lib/planos";

export type AssinaturaAtiva = {
  id: string;
  cliente_id: string;
  plano_id: string;
  status: "ativo" | "cancelado" | "expirado";
  tipo_renovacao: "manual" | "automatica";
  inicio_ciclo: string;
  fim_ciclo: string;
  proxima_renovacao: string;
  cortes_totais: number;
  cortes_restantes: number;
  cortes_reservados: number;
  barbas_totais: number;
  barbas_restantes: number;
  barbas_reservadas: number;
  sobrancelhas_totais: number;
  sobrancelhas_restantes: number;
  sobrancelhas_reservadas: number;
  observacoes_internas: string | null;
  ultimo_alerta_vencimento_em?: string | null;
};

export type CategoriaPlano = "corte" | "barba" | "sobrancelha";
export type TipoMovimentacaoPlano =
  | "reserva_credito"
  | "consumo_credito"
  | "devolucao_credito"
  | "renovacao"
  | "troca_imediata"
  | "uso_manual";

export type AssinaturaMovimentacao = {
  id: string;
  assinatura_id: string;
  cliente_id: string;
  categoria_servico: string;
  tipo_movimentacao: TipoMovimentacaoPlano;
  quantidade: number;
  agendamento_id: string | null;
  observacao: string | null;
  created_at: string;
};

type ClienteNotificacao = {
  nome?: string;
  telefone?: string;
} | null;

type AssinaturaNotificacao = {
  id: string;
  cliente_id: string;
  plano_id: string;
  status: "ativo" | "cancelado" | "expirado";
  tipo_renovacao: "manual" | "automatica";
  inicio_ciclo: string;
  fim_ciclo: string;
  proxima_renovacao: string;
  ultimo_alerta_vencimento_em?: string | null;
  clientes?: ClienteNotificacao | ClienteNotificacao[] | null;
};

function addDays(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function diffDaysInclusive(startIso: string, endIso: string) {
  const [startYear, startMonth, startDay] = startIso.split("-").map(Number);
  const [endYear, endMonth, endDay] = endIso.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function getTodaySaoPauloIso(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(referenceDate);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertValidCycleRange(inicioCiclo: string, fimCiclo: string) {
  if (!isIsoDate(inicioCiclo) || !isIsoDate(fimCiclo)) {
    throw new Error("Datas do ciclo devem estar no formato YYYY-MM-DD.");
  }

  if (fimCiclo < inicioCiclo) {
    throw new Error("fim_ciclo nao pode ser anterior ao inicio_ciclo.");
  }
}

function getReservedSummary(
  assinatura: Pick<AssinaturaAtiva, "cortes_reservados" | "barbas_reservadas" | "sobrancelhas_reservadas">
) {
  const cortes = Number(assinatura.cortes_reservados ?? 0);
  const barbas = Number(assinatura.barbas_reservadas ?? 0);
  const sobrancelhas = Number(assinatura.sobrancelhas_reservadas ?? 0);

  return {
    cortes,
    barbas,
    sobrancelhas,
    total: cortes + barbas + sobrancelhas,
  };
}

function buildCyclePatchFromPlano(
  assinatura: Pick<AssinaturaAtiva, "cortes_reservados" | "barbas_reservadas" | "sobrancelhas_reservadas">,
  plano: Plano,
  inicioCiclo: string,
  fimCiclo: string
) {
  const reservados = getReservedSummary(assinatura);
  const cortesTotais = Math.max(plano.cortes_incluidos, reservados.cortes);
  const barbasTotais = Math.max(plano.barbas_incluidas, reservados.barbas);
  const sobrancelhasTotais = Math.max(plano.sobrancelhas_incluidas, reservados.sobrancelhas);

  return {
    inicio_ciclo: inicioCiclo,
    fim_ciclo: fimCiclo,
    proxima_renovacao: fimCiclo,
    cortes_totais: cortesTotais,
    cortes_restantes: Math.max(0, cortesTotais - reservados.cortes),
    cortes_reservados: reservados.cortes,
    barbas_totais: barbasTotais,
    barbas_restantes: Math.max(0, barbasTotais - reservados.barbas),
    barbas_reservadas: reservados.barbas,
    sobrancelhas_totais: sobrancelhasTotais,
    sobrancelhas_restantes: Math.max(0, sobrancelhasTotais - reservados.sobrancelhas),
    sobrancelhas_reservadas: reservados.sobrancelhas,
  };
}

type AssinaturaPeriodoBase = Pick<
  AssinaturaAtiva,
  "status" | "tipo_renovacao" | "inicio_ciclo" | "fim_ciclo" | "proxima_renovacao"
>;

export function projectAssinaturaPeriodo<T extends AssinaturaPeriodoBase>(assinatura: T, referenceDate = new Date()) {
  const hoje = getTodaySaoPauloIso(referenceDate);

  if (assinatura.status !== "ativo") {
    return null;
  }

  if (assinatura.tipo_renovacao === "manual" && assinatura.fim_ciclo < hoje) {
    return null;
  }

  let projected = { ...assinatura };

  while (projected.tipo_renovacao === "automatica" && projected.fim_ciclo < hoje) {
    const duracaoCiclo = diffDaysInclusive(projected.inicio_ciclo, projected.fim_ciclo);
    const novoInicio = addDays(projected.fim_ciclo, 1);
    const novoFim = addDays(novoInicio, duracaoCiclo - 1);
    projected = {
      ...projected,
      inicio_ciclo: novoInicio,
      fim_ciclo: novoFim,
      proxima_renovacao: novoFim,
    };
  }

  return projected;
}

async function projectAssinaturaAtivaForRead(assinatura: AssinaturaAtiva, referenceDate = new Date()) {
  const periodoAtual = projectAssinaturaPeriodo(assinatura, referenceDate);

  if (!periodoAtual) {
    return null;
  }

  if (
    periodoAtual.inicio_ciclo === assinatura.inicio_ciclo &&
    periodoAtual.fim_ciclo === assinatura.fim_ciclo &&
    periodoAtual.proxima_renovacao === assinatura.proxima_renovacao
  ) {
    return assinatura;
  }

  const plano = await buscarPlanoPorId(assinatura.plano_id);
  if (!plano) {
    return {
      ...assinatura,
      ...periodoAtual,
    };
  }

  let projected = { ...assinatura };
  const hoje = getTodaySaoPauloIso(referenceDate);

  while (projected.tipo_renovacao === "automatica" && projected.fim_ciclo < hoje) {
    const duracaoCiclo = diffDaysInclusive(projected.inicio_ciclo, projected.fim_ciclo);
    const novoInicio = addDays(projected.fim_ciclo, 1);
    const novoFim = addDays(novoInicio, duracaoCiclo - 1);
    projected = {
      ...projected,
      status: "ativo",
      ...buildCyclePatchFromPlano(projected, plano, novoInicio, novoFim),
    };
  }

  return projected;
}

export async function buscarAssinaturaAtiva(clienteId: string) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return projectAssinaturaAtivaForRead(data as AssinaturaAtiva);
}

export async function buscarAssinaturaPorId(assinaturaId: string) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva | null;
}

export async function listarMovimentacoesAssinatura(assinaturaId: string) {
  const { data, error } = await supabase
    .from("assinatura_movimentacoes")
    .select("*")
    .eq("assinatura_id", assinaturaId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssinaturaMovimentacao[];
}

export async function listarMovimentacoesCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("assinatura_movimentacoes")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssinaturaMovimentacao[];
}

async function registrarMovimentacaoAssinatura(params: {
  assinaturaId: string;
  clienteId: string;
  categoriaServico?: string;
  tipoMovimentacao: TipoMovimentacaoPlano;
  quantidade?: number;
  agendamentoId?: string | null;
  observacao?: string | null;
}) {
  const { error } = await supabase.from("assinatura_movimentacoes").insert({
    assinatura_id: params.assinaturaId,
    cliente_id: params.clienteId,
    categoria_servico: params.categoriaServico ?? "outro",
    tipo_movimentacao: params.tipoMovimentacao,
    quantidade: params.quantidade ?? 1,
    agendamento_id: params.agendamentoId ?? null,
    observacao: params.observacao ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sincronizarAssinaturas(referenceDate = new Date()) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("status", "ativo")
    .order("proxima_renovacao", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const assinaturas = (data ?? []) as AssinaturaAtiva[];
  let atualizadas = 0;

  for (const assinatura of assinaturas) {
    const periodoAtual = projectAssinaturaPeriodo(assinatura, referenceDate);

    if (!periodoAtual) {
      const { error: updateError } = await supabase
        .from("assinaturas")
        .update({ status: "expirado" })
        .eq("id", assinatura.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
      atualizadas += 1;
      continue;
    }

    if (
      periodoAtual.inicio_ciclo !== assinatura.inicio_ciclo ||
      periodoAtual.fim_ciclo !== assinatura.fim_ciclo ||
      periodoAtual.proxima_renovacao !== assinatura.proxima_renovacao
    ) {
      const { data: plano, error: planoError } = await supabase
        .from("planos")
        .select("*")
        .eq("id", assinatura.plano_id)
        .maybeSingle();

      if (planoError || !plano) {
        throw new Error(planoError?.message || "Plano da assinatura nao encontrado.");
      }

      const { error: updateError } = await supabase
        .from("assinaturas")
        .update({
          status: "ativo",
          ...buildCyclePatchFromPlano(
            assinatura,
            plano as Plano,
            periodoAtual.inicio_ciclo,
            periodoAtual.fim_ciclo
          ),
        })
        .eq("id", assinatura.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
      atualizadas += 1;

      await registrarMovimentacaoAssinatura({
        assinaturaId: assinatura.id,
        clienteId: assinatura.cliente_id,
        tipoMovimentacao: "renovacao",
        observacao: `Renovacao automatica do plano ${plano.nome} para o ciclo ${periodoAtual.inicio_ciclo} ate ${periodoAtual.fim_ciclo}`,
      });
    }
  }

  return atualizadas;
}

export async function listarNotificacoesAssinatura(referenceDate = new Date()) {
  const hoje = getTodaySaoPauloIso(referenceDate);
  const proximos3 = addDays(hoje, 3);

  const { data, error } = await supabase
    .from("assinaturas")
    .select("id, cliente_id, plano_id, status, tipo_renovacao, inicio_ciclo, fim_ciclo, proxima_renovacao, ultimo_alerta_vencimento_em, clientes(nome, telefone)")
    .eq("status", "ativo")
    .order("proxima_renovacao", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const notificacoes = ((data ?? []) as unknown as AssinaturaNotificacao[])
    .map((item) => {
      const periodoAtual = projectAssinaturaPeriodo(item, referenceDate);
      if (!periodoAtual) {
        return null;
      }

      return {
        ...item,
        ...periodoAtual,
        clientes: Array.isArray(item.clientes) ? (item.clientes[0] ?? null) : (item.clientes ?? null),
      };
    })
    .filter((item): item is AssinaturaNotificacao & { clientes: ClienteNotificacao } => Boolean(item))
    .filter((item) => item.proxima_renovacao <= proximos3)
    .sort((a, b) => a.proxima_renovacao.localeCompare(b.proxima_renovacao));
  const vencendoHoje = notificacoes.filter((item) => item.proxima_renovacao === hoje);

  return {
    hoje,
    notificacoes,
    vencendoHoje,
  };
}

export function categoriaPodeUsarPlano(categoria: string): categoria is CategoriaPlano {
  return categoria === "corte" || categoria === "barba" || categoria === "sobrancelha";
}

function getCamposPorCategoria(categoria: CategoriaPlano) {
  if (categoria === "corte") {
    return { restante: "cortes_restantes", reservado: "cortes_reservados" } as const;
  }
  if (categoria === "barba") {
    return { restante: "barbas_restantes", reservado: "barbas_reservadas" } as const;
  }
  return { restante: "sobrancelhas_restantes", reservado: "sobrancelhas_reservadas" } as const;
}

export async function reservarCreditoPlano(params: {
  assinaturaId: string;
  clienteId: string;
  categoria: CategoriaPlano;
  agendamentoId: string;
  quantidade?: number;
  observacao?: string;
}) {
  const quantidade = params.quantidade ?? 1;
  const assinatura = await buscarAssinaturaPorId(params.assinaturaId);

  if (!assinatura || assinatura.cliente_id !== params.clienteId || assinatura.status !== "ativo") {
    throw new Error("Assinatura ativa nao encontrada.");
  }

  const campos = getCamposPorCategoria(params.categoria);
  const restanteAtual = Number(assinatura[campos.restante]);
  const reservadoAtual = Number(assinatura[campos.reservado]);

  if (restanteAtual < quantidade) {
    throw new Error("Saldo insuficiente no plano.");
  }

  const patch: Record<string, number> = {};
  patch[campos.restante] = restanteAtual - quantidade;
  patch[campos.reservado] = reservadoAtual + quantidade;

  const { data: updated, error: updateError } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinatura.id)
    .eq(campos.restante, restanteAtual)
    .eq(campos.reservado, reservadoAtual)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated) {
    throw new Error("Os creditos do plano foram alterados por outra operacao. Tente novamente.");
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: assinatura.id,
    clienteId: params.clienteId,
    categoriaServico: params.categoria,
    tipoMovimentacao: "reserva_credito",
    quantidade,
    agendamentoId: params.agendamentoId,
    observacao: params.observacao ?? null,
  });
}

export async function liquidarCreditoPlano(params: {
  assinaturaId: string;
  clienteId: string;
  categoria: CategoriaPlano;
  agendamentoId: string;
  tipo: "consumo_credito" | "devolucao_credito";
  quantidade?: number;
  observacao?: string;
}) {
  const quantidade = params.quantidade ?? 1;
  const assinatura = await buscarAssinaturaPorId(params.assinaturaId);

  if (!assinatura || assinatura.cliente_id !== params.clienteId) {
    throw new Error("Assinatura vinculada nao encontrada.");
  }

  const campos = getCamposPorCategoria(params.categoria);
  const restanteAtual = Number(assinatura[campos.restante]);
  const reservadoAtual = Number(assinatura[campos.reservado]);

  if (reservadoAtual < quantidade) {
    throw new Error("Não há créditos reservados suficientes.");
  }

  const patch: Record<string, number> = {};
  patch[campos.reservado] = reservadoAtual - quantidade;
  patch[campos.restante] = params.tipo === "devolucao_credito" ? restanteAtual + quantidade : restanteAtual;

  const { data: updated, error: updateError } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinatura.id)
    .eq(campos.restante, restanteAtual)
    .eq(campos.reservado, reservadoAtual)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated) {
    throw new Error("Os creditos reservados foram alterados por outra operacao. Tente novamente.");
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: assinatura.id,
    clienteId: params.clienteId,
    categoriaServico: params.categoria,
    tipoMovimentacao: params.tipo,
    quantidade,
    agendamentoId: params.agendamentoId,
    observacao: params.observacao ?? null,
  });
}

export async function registrarUsoManualPlano(params: {
  assinaturaId: string;
  clienteId: string;
  categoria: CategoriaPlano;
  quantidade?: number;
  observacao?: string;
}) {
  const quantidade = params.quantidade ?? 1;
  const assinatura = await buscarAssinaturaAtiva(params.clienteId);

  if (!assinatura || assinatura.id !== params.assinaturaId) {
    throw new Error("Assinatura ativa nao encontrada.");
  }

  const campos = getCamposPorCategoria(params.categoria);
  const restanteAtual = Number(assinatura[campos.restante]);

  if (restanteAtual < quantidade) {
    throw new Error("Saldo insuficiente no plano para registrar uso manual.");
  }

  const patch: Record<string, number> = {};
  patch[campos.restante] = restanteAtual - quantidade;

  const { data: updated, error: updateError } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinatura.id)
    .eq(campos.restante, restanteAtual)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated) {
    throw new Error("O saldo do plano foi alterado por outra operacao. Tente novamente.");
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: assinatura.id,
    clienteId: params.clienteId,
    categoriaServico: params.categoria,
    tipoMovimentacao: "uso_manual",
    quantidade,
    observacao: params.observacao ?? null,
  });
}

export async function criarAssinatura(params: {
  clienteId: string;
  plano: Plano;
  tipoRenovacao: "manual" | "automatica";
  inicioCiclo: string;
  fimCiclo: string;
  observacoes?: string;
}) {
  assertValidCycleRange(params.inicioCiclo, params.fimCiclo);

  const assinaturaAtual = await buscarAssinaturaAtiva(params.clienteId);
  if (assinaturaAtual) {
    throw new Error("Cliente ja possui um plano ativo.");
  }

  const payload = {
    cliente_id: params.clienteId,
    plano_id: params.plano.id,
    status: "ativo",
    tipo_renovacao: params.tipoRenovacao,
    inicio_ciclo: params.inicioCiclo,
    fim_ciclo: params.fimCiclo,
    proxima_renovacao: params.fimCiclo,
    cortes_totais: params.plano.cortes_incluidos,
    cortes_restantes: params.plano.cortes_incluidos,
    cortes_reservados: 0,
    barbas_totais: params.plano.barbas_incluidas,
    barbas_restantes: params.plano.barbas_incluidas,
    barbas_reservadas: 0,
    sobrancelhas_totais: params.plano.sobrancelhas_incluidas,
    sobrancelhas_restantes: params.plano.sobrancelhas_incluidas,
    sobrancelhas_reservadas: 0,
    observacoes_internas: params.observacoes ?? null,
  };

  const observacao = `Ativacao inicial do plano ${params.plano.nome}`;
  const { data, error } = await supabase.rpc("create_assinatura_with_receita_atomic", {
    p_payload: payload,
    p_plano_nome: params.plano.nome,
    p_valor: Number(params.plano.preco),
    p_competencia: params.inicioCiclo,
    p_observacao: observacao,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva;
}

export async function renovarAssinatura(assinaturaId: string, plano: Plano, inicioCiclo: string, fimCiclo: string) {
  assertValidCycleRange(inicioCiclo, fimCiclo);

  const { data: assinatura, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (assinaturaError || !assinatura) {
    throw new Error(assinaturaError?.message || "Assinatura nao encontrada.");
  }

  const patch = {
    ...buildCyclePatchFromPlano(assinatura as AssinaturaAtiva, plano, inicioCiclo, fimCiclo),
    status: "ativo",
    plano_id: plano.id,
    observacoes_internas: assinatura.observacoes_internas ?? null,
  };

  const observacao = `Renovacao manual do plano ${plano.nome} para o ciclo ${inicioCiclo} ate ${fimCiclo}`;
  const { data, error } = await supabase.rpc("renew_assinatura_with_receita_atomic", {
    p_assinatura_id: assinaturaId,
    p_patch: patch,
    p_plano_nome: plano.nome,
    p_valor: Number(plano.preco),
    p_competencia: inicioCiclo,
    p_observacao: observacao,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva;
}

export async function aplicarTrocaImediata(assinaturaId: string, plano: Plano) {
  const { data: assinatura, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (assinaturaError || !assinatura) {
    throw new Error(assinaturaError?.message || "Assinatura nao encontrada.");
  }

  const patch = {
    plano_id: plano.id,
    cortes_totais: Number(assinatura.cortes_totais ?? 0) + plano.cortes_incluidos,
    cortes_restantes: Number(assinatura.cortes_restantes ?? 0) + plano.cortes_incluidos,
    barbas_totais: Number(assinatura.barbas_totais ?? 0) + plano.barbas_incluidas,
    barbas_restantes: Number(assinatura.barbas_restantes ?? 0) + plano.barbas_incluidas,
    sobrancelhas_totais: Number(assinatura.sobrancelhas_totais ?? 0) + plano.sobrancelhas_incluidas,
    sobrancelhas_restantes: Number(assinatura.sobrancelhas_restantes ?? 0) + plano.sobrancelhas_incluidas,
  };

  const { data, error } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId,
    clienteId: assinatura.cliente_id,
    tipoMovimentacao: "troca_imediata",
    observacao: `Troca imediata para o plano ${plano.nome}`,
  });

  return data as AssinaturaAtiva;
}

export async function atualizarObservacoesAssinatura(assinaturaId: string, observacoes: string | null) {
  const { data, error } = await supabase
    .from("assinaturas")
    .update({ observacoes_internas: observacoes })
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva;
}

export async function cancelarAssinatura(assinaturaId: string) {
  const assinatura = await buscarAssinaturaPorId(assinaturaId);

  if (!assinatura) {
    throw new Error("Assinatura nao encontrada.");
  }

  if (getReservedSummary(assinatura).total > 0) {
    throw new Error("Não é possível cancelar o plano com créditos reservados em agendamentos futuros.");
  }

  const { data, error } = await supabase
    .from("assinaturas")
    .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva;
}
