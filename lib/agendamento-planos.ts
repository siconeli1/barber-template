import type { Servico, ServicePlanCoverage } from "@/lib/servicos";
import { getServicePlanCoverage, hasPlanCoverage } from "@/lib/servicos";
import { buscarAssinaturaAtiva, categoriaPodeUsarPlano, liquidarCreditoPlano, reservarCreditoPlano } from "@/lib/assinaturas";
import { supabase } from "@/lib/supabase";

export type AgendamentoPlanCoverageStatus =
  | "sem_plano"
  | "coberto_com_plano"
  | "saldo_esgotado"
  | "nao_coberto"
  | "combo_avulso";

export type AgendamentoPlanCoverageDecision = {
  status: AgendamentoPlanCoverageStatus;
  confirmar_como: "plano" | "avulso";
  servico_referencia: string | null;
  mensagem: string | null;
  warning_tone: "danger" | "warning" | null;
  requires_avulso_confirmation: boolean;
};

export type AgendamentoItemPlanoDecision = {
  servico: Servico;
  tipo_cobranca: "plano" | "avulso";
  status_credito: "reservado" | "nao_aplicavel";
  assinatura_id: string | null;
  creditos_plano: ServicePlanCoverage;
  cobertura_plano: AgendamentoPlanCoverageDecision;
};

export type AgendamentoCobrancaDecision = {
  assinatura: Awaited<ReturnType<typeof buscarAssinaturaAtiva>>;
  itens: AgendamentoItemPlanoDecision[];
  itensSemSaldo: Servico[];
};

type PlanoSaldoState = Record<"corte" | "barba" | "sobrancelha", number>;
type PlanoTotalState = Record<"corte" | "barba" | "sobrancelha", number>;

const COMPONENT_LABELS: Record<keyof PlanoSaldoState, string> = {
  corte: "corte de cabelo",
  barba: "barba",
  sobrancelha: "sobrancelha",
};

function applyCoverage(
  saldos: Record<"corte" | "barba" | "sobrancelha", number>,
  coverage: ServicePlanCoverage
) {
  saldos.corte -= coverage.corte;
  saldos.barba -= coverage.barba;
  saldos.sobrancelha -= coverage.sobrancelha;
}

function getCoverageEntries(coverage: ServicePlanCoverage) {
  return ([
    ["corte", coverage.corte],
    ["barba", coverage.barba],
    ["sobrancelha", coverage.sobrancelha],
  ] as const).filter(([, quantidade]) => quantidade > 0);
}

function getCoverageEntriesWithLabels(coverage: ServicePlanCoverage) {
  return getCoverageEntries(coverage).map(([categoria, quantidade]) => ({
    categoria,
    quantidade,
    nome_servico: COMPONENT_LABELS[categoria],
  }));
}

function buildPlanoStatesFromAssinatura(assinatura: {
  cortes_totais?: number | null;
  cortes_restantes?: number | null;
  barbas_totais?: number | null;
  barbas_restantes?: number | null;
  sobrancelhas_totais?: number | null;
  sobrancelhas_restantes?: number | null;
}) {
  const totais: PlanoTotalState = {
    corte: Number(assinatura.cortes_totais ?? 0),
    barba: Number(assinatura.barbas_totais ?? 0),
    sobrancelha: Number(assinatura.sobrancelhas_totais ?? 0),
  };
  const saldos: PlanoSaldoState = {
    corte: Number(assinatura.cortes_restantes ?? 0),
    barba: Number(assinatura.barbas_restantes ?? 0),
    sobrancelha: Number(assinatura.sobrancelhas_restantes ?? 0),
  };

  return { totais, saldos };
}

function buildCoverageDecisionForService(params: {
  assinatura: {
    id: string;
    cortes_totais?: number | null;
    cortes_restantes?: number | null;
    barbas_totais?: number | null;
    barbas_restantes?: number | null;
    sobrancelhas_totais?: number | null;
    sobrancelhas_restantes?: number | null;
  } | null;
  servico: Servico;
  saldosAtuais?: PlanoSaldoState;
}) {
  const { assinatura, servico } = params;
  const coverage = getServicePlanCoverage(servico);

  if (!assinatura) {
    return {
      creditos_plano: coverage,
      decision: {
        status: "sem_plano" as const,
        confirmar_como: "avulso" as const,
        servico_referencia: null,
        mensagem: null,
        warning_tone: null,
        requires_avulso_confirmation: false,
      },
    };
  }

  const { totais, saldos } = buildPlanoStatesFromAssinatura(assinatura);
  const saldosConsiderados = params.saldosAtuais ?? saldos;
  const entries = getCoverageEntriesWithLabels(coverage);
  const isCombo = servico.categoria === "combo" || entries.length > 1;

  if (entries.length === 0 || !hasPlanCoverage(servico)) {
    return {
      creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      decision: {
        status: "nao_coberto" as const,
        confirmar_como: "avulso" as const,
        servico_referencia: servico.nome,
        mensagem: "O seu plano não cobre esse tipo de serviço, gostaria de agendar com pagamento avulso?",
        warning_tone: "warning" as const,
        requires_avulso_confirmation: true,
      },
    };
  }

  const primeiraCategoriaSemCobertura = entries.find(
    (entry) => totais[entry.categoria] < entry.quantidade
  );
  const primeiraCategoriaSemSaldo = entries.find(
    (entry) =>
      totais[entry.categoria] >= entry.quantidade &&
      saldosConsiderados[entry.categoria] < entry.quantidade
  );

  if (isCombo && (primeiraCategoriaSemCobertura || primeiraCategoriaSemSaldo)) {
    const componenteFaltante = primeiraCategoriaSemCobertura ?? primeiraCategoriaSemSaldo!;
    return {
      creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      decision: {
        status: "combo_avulso" as const,
        confirmar_como: "avulso" as const,
        servico_referencia: componenteFaltante.nome_servico,
        mensagem: `Seu plano não cobre o serviço de ${componenteFaltante.nome_servico}, deseja marcar o serviço como avulso?`,
        warning_tone: "danger" as const,
        requires_avulso_confirmation: true,
      },
    };
  }

  if (primeiraCategoriaSemCobertura) {
    return {
      creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      decision: {
        status: "nao_coberto" as const,
        confirmar_como: "avulso" as const,
        servico_referencia: servico.nome,
        mensagem: "O seu plano não cobre esse tipo de serviço, gostaria de agendar com pagamento avulso?",
        warning_tone: "warning" as const,
        requires_avulso_confirmation: true,
      },
    };
  }

  if (primeiraCategoriaSemSaldo) {
    return {
      creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      decision: {
        status: "saldo_esgotado" as const,
        confirmar_como: "avulso" as const,
        servico_referencia: servico.nome,
        mensagem: `Os créditos de ${servico.nome} do seu plano esgotaram, gostaria de marcar agendamento com pagamento avulso?`,
        warning_tone: "danger" as const,
        requires_avulso_confirmation: true,
      },
    };
  }

  return {
    creditos_plano: coverage,
    decision: {
      status: "coberto_com_plano" as const,
      confirmar_como: "plano" as const,
      servico_referencia: servico.nome,
      mensagem: null,
      warning_tone: null,
      requires_avulso_confirmation: false,
    },
  };
}

export function calcularValorFinalDosItens(itens: AgendamentoItemPlanoDecision[]) {
  return itens.reduce((acc, item) => acc + (item.tipo_cobranca === "avulso" ? Number(item.servico.preco ?? 0) : 0), 0);
}

export async function decidirCoberturaServicoNoPlano(clienteId: string, servico: Servico) {
  const assinatura = await buscarAssinaturaAtiva(clienteId);
  const { decision } = buildCoverageDecisionForService({ assinatura, servico });
  return decision;
}

export async function decidirCobrancaItens(
  clienteId: string,
  servicos: Servico[]
): Promise<AgendamentoCobrancaDecision> {
  const assinatura = await buscarAssinaturaAtiva(clienteId);

  if (!assinatura) {
    return {
      assinatura: null,
      itens: servicos.map(
        (servico): AgendamentoItemPlanoDecision => ({
          servico,
          tipo_cobranca: "avulso",
          status_credito: "nao_aplicavel",
          assinatura_id: null,
          creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
          cobertura_plano: {
            status: "sem_plano",
            confirmar_como: "avulso",
            servico_referencia: null,
            mensagem: null,
            warning_tone: null,
            requires_avulso_confirmation: false,
          },
        })
      ),
      itensSemSaldo: [],
    };
  }

  const saldos = buildPlanoStatesFromAssinatura(assinatura).saldos;

  const itensSemSaldo: Servico[] = [];
  const itens: AgendamentoItemPlanoDecision[] = [];

  for (const servico of servicos) {
    const { decision, creditos_plano } = buildCoverageDecisionForService({
      assinatura,
      servico,
      saldosAtuais: saldos,
    });

    if (decision.confirmar_como === "plano") {
      const coverage = getServicePlanCoverage(servico);
      applyCoverage(saldos, coverage);
      itens.push({
        servico,
        tipo_cobranca: "plano",
        status_credito: "reservado",
        assinatura_id: assinatura.id,
        creditos_plano: coverage,
        cobertura_plano: decision,
      });
    } else {
      if (decision.requires_avulso_confirmation) {
        itensSemSaldo.push(servico);
      }
      itens.push({
        servico,
        tipo_cobranca: "avulso",
        status_credito: "nao_aplicavel",
        assinatura_id: null,
        creditos_plano,
        cobertura_plano: decision,
      });
    }
  }

  return { assinatura, itens, itensSemSaldo };
}

export async function reservarCreditosDoAgendamento(clienteId: string, agendamentoId: string, itens: AgendamentoItemPlanoDecision[]) {
  for (const item of itens) {
    if (item.tipo_cobranca === "plano" && item.assinatura_id) {
      for (const [categoria, quantidade] of getCoverageEntries(item.creditos_plano)) {
        if (categoriaPodeUsarPlano(categoria)) {
          await reservarCreditoPlano({
            assinaturaId: item.assinatura_id,
            clienteId,
            categoria,
            agendamentoId,
            quantidade,
            observacao: `Reserva do servico ${item.servico.nome}`,
          });
        }
      }
    }
  }
}

export async function liquidarCreditosDoAgendamento(agendamentoId: string, tipo: "consumo_credito" | "devolucao_credito") {
  const { data: agendamento, error: agendamentoError } = await supabase
    .from("agendamentos")
    .select("id, cliente_id")
    .eq("id", agendamentoId)
    .maybeSingle();

  if (agendamentoError || !agendamento?.cliente_id) {
    if (agendamentoError) throw new Error(agendamentoError.message);
    return;
  }

  const { data: itens, error } = await supabase
    .from("agendamento_itens")
    .select("id, assinatura_id, status_credito, creditos_corte, creditos_barba, creditos_sobrancelha")
    .eq("agendamento_id", agendamentoId);

  if (error) {
    throw new Error(error.message);
  }

  for (const item of itens ?? []) {
    const coverage: ServicePlanCoverage = {
      corte: Number(item.creditos_corte ?? 0),
      barba: Number(item.creditos_barba ?? 0),
      sobrancelha: Number(item.creditos_sobrancelha ?? 0),
    };

    if (item.assinatura_id && item.status_credito === "reservado") {
      for (const [categoria, quantidade] of getCoverageEntries(coverage)) {
        if (categoriaPodeUsarPlano(categoria)) {
          await liquidarCreditoPlano({
            assinaturaId: item.assinatura_id,
            clienteId: agendamento.cliente_id,
            categoria,
            agendamentoId,
            tipo,
            quantidade,
          });
        }
      }

      await supabase
        .from("agendamento_itens")
        .update({ status_credito: tipo === "consumo_credito" ? "consumido" : "devolvido" })
        .eq("id", item.id);
    }
  }
}

export async function registrarReceitaAvulsaDoAgendamento(agendamentoId: string) {
  const { data: agendamento, error: agendamentoError } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, data")
    .eq("id", agendamentoId)
    .maybeSingle();

  if (agendamentoError || !agendamento) {
    throw new Error(agendamentoError?.message || "Agendamento nao encontrado.");
  }

  const { data: itens, error } = await supabase
    .from("agendamento_itens")
    .select("servico_nome, servico_preco, tipo_cobranca")
    .eq("agendamento_id", agendamentoId)
    .eq("tipo_cobranca", "avulso");

  if (error) {
    throw new Error(error.message);
  }

  const { data: existentes, error: existentesError } = await supabase
    .from("financeiro_lancamentos")
    .select("descricao")
    .eq("agendamento_id", agendamentoId)
    .eq("categoria_financeira", "receita_servico_avulso");

  if (existentesError) {
    throw new Error(existentesError.message);
  }

  const descricoesExistentes = new Set((existentes ?? []).map((item) => String(item.descricao)));

  for (const item of itens ?? []) {
    const descricao = `Servico avulso: ${item.servico_nome}`;

    if (descricoesExistentes.has(descricao)) {
      continue;
    }

    await supabase.from("financeiro_lancamentos").insert({
      cliente_id: agendamento.cliente_id,
      agendamento_id: agendamentoId,
      categoria_financeira: "receita_servico_avulso",
      descricao,
      valor: Number(item.servico_preco ?? 0),
      competencia: agendamento.data,
    });
    descricoesExistentes.add(descricao);
  }
}
