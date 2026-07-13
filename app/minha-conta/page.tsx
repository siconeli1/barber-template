"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StatusAgendamento } from "@/lib/agendamento";
import { NoticeToast } from "@/app/_components/NoticeToast";
import { Skeleton, SkeletonInfoBox } from "@/app/_components/Skeleton";
import { formatarDataISO } from "@/lib/format";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import { useCustomerSession } from "@/lib/use-customer-session";

type DashboardPayload = {
  profile: {
    id: string;
    nome: string;
    telefone: string;
  } | null;
  assinatura: {
    plano_id?: string | null;
    proxima_renovacao?: string | null;
    inicio_ciclo?: string | null;
    fim_ciclo?: string | null;
    cortes_restantes?: number | null;
    barbas_restantes?: number | null;
    sobrancelhas_restantes?: number | null;
  } | null;
  plano: {
    nome?: string | null;
  } | null;
  reservas: Array<{
    id: string;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    servico_nome?: string | null;
    status_agendamento?: string | null;
    status_atendimento?: string | null;
    tipo_cobranca?: string | null;
    valor_final?: number | null;
  }>;
  financeiro: Array<{
    id: string;
    descricao: string;
    valor: number;
    competencia: string;
  }>;
  historico_uso: Array<{
    id: string;
    tipo_movimentacao: string;
    titulo: string;
    descricao: string;
    quantidade: number;
    created_at?: string;
    detalhes?: {
      data?: string | null;
      hora_inicio?: string | null;
      hora_fim?: string | null;
      barbeiro_nome?: string | null;
      servico_nome?: string | null;
      status_agendamento?: StatusAgendamento | null;
      status_atendimento?: string | null;
    } | null;
  }>;
};

export default function MinhaContaPage() {
  const { profile, sessionReady, signOut } = useCustomerSession();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [erro, setErro] = useAutoDismissState();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);

  const buscarDashboard = useCallback(
    async (telefone: string) => {
      setLoading(true);
      setLoadFailed(false);
      setErro("");

      try {
        const res = await fetch(`/api/client/dashboard?telefone=${encodeURIComponent(telefone)}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok) {
          setErro(json.erro || "Erro ao carregar sua conta.");
          setLoadFailed(true);
          return;
        }

        setDashboard({
          profile: json.profile ?? null,
          assinatura: json.assinatura ?? null,
          plano: json.plano ?? null,
          reservas: json.reservas ?? [],
          financeiro: json.financeiro ?? [],
          historico_uso: json.historico_uso ?? [],
        });
      } catch {
        setErro("Não foi possível carregar sua conta agora.");
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [setErro]
  );

  useEffect(() => {
    if (!sessionReady || !profile?.telefone) {
      setDashboard(null);
      return;
    }

    void buscarDashboard(profile.telefone);
  }, [buscarDashboard, profile, sessionReady]);

  const assinatura = dashboard?.assinatura ?? null;
  const plano = dashboard?.plano ?? null;
  const possuiPlanoAtivo = Boolean(assinatura && plano);
  const assinaturaAtiva = possuiPlanoAtivo ? assinatura : null;
  const ultimosUsos = useMemo(() => (dashboard?.historico_uso ?? []).slice(0, 6), [dashboard]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Voltar</span>
          </Link>

          {profile ? (
            <div className="flex flex-wrap gap-2">
              {loadFailed ? (
                <button
                  type="button"
                  onClick={() => void buscarDashboard(profile.telefone)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-5 py-3 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
                >
                  Tentar novamente
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setDashboard(null);
                  setLoadFailed(false);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/10"
              >
                Trocar cadastro
              </button>
            </div>
          ) : null}
        </div>

        <section className="rounded-[34px] border border-white/10 bg-[#070707] p-6 sm:p-8">
          <h1 className="text-4xl font-semibold">Minha conta</h1>

          {erro ? <NoticeToast tone="danger">{erro}</NoticeToast> : null}

          {!sessionReady ? (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <SkeletonInfoBox />
                <SkeletonInfoBox />
                <SkeletonInfoBox />
              </div>
              <div className="rounded-[28px] border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-40" />
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <SkeletonInfoBox key={i} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {sessionReady && !profile ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
              <h2 className="text-2xl font-semibold">Conta não identificada</h2>
              <p className="mt-2 text-[var(--muted)]">
                Informe seu celular para acessar seu cadastro e visualizar o seu plano.
              </p>
              <div className="mt-5">
                <Link
                  href="/login?next=/minha-conta"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
                >
                  Informar meu celular
                </Link>
              </div>
            </div>
          ) : null}

          {loading && profile ? (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <SkeletonInfoBox />
                <SkeletonInfoBox />
                <SkeletonInfoBox />
              </div>
              <div className="rounded-[28px] border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-40" />
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <SkeletonInfoBox key={i} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && profile && dashboard && !dashboard.profile ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
              <h2 className="text-2xl font-semibold">Cadastro não encontrado</h2>
              <p className="mt-2 text-[var(--muted)]">
                Não encontramos mais um cadastro ativo para esse número. Faça um novo agendamento para recriar seu cadastro.
              </p>
            </div>
          ) : null}

          {!loading && dashboard?.profile ? (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <InfoBox label="Nome" value={String(dashboard.profile.nome ?? "-")} />
                <InfoBox label="Celular" value={String(dashboard.profile.telefone ?? "-")} />
                <InfoBox label="Plano atual" value={String(plano?.nome ?? "Sem plano ativo")} />
              </div>

              {assinaturaAtiva ? (
                <section className="rounded-[28px] border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Plano mensal</p>
                    <h2 className="mt-2 text-2xl font-semibold">{plano?.nome ?? "Plano ativo"}</h2>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoBox label="Próxima renovação" value={formatDateValue(assinaturaAtiva.proxima_renovacao)} />
                    <InfoBox
                      label="Período"
                      value={`${formatDateValue(assinaturaAtiva.inicio_ciclo)} até ${formatDateValue(assinaturaAtiva.fim_ciclo)}`}
                    />
                    <InfoBox label="Cortes restantes" value={String(assinaturaAtiva.cortes_restantes ?? 0)} />
                    <InfoBox label="Barbas restantes" value={String(assinaturaAtiva.barbas_restantes ?? 0)} />
                    <InfoBox label="Sobrancelhas restantes" value={String(assinaturaAtiva.sobrancelhas_restantes ?? 0)} />
                  </div>
                </section>
              ) : null}

              {assinaturaAtiva && ultimosUsos.length > 0 ? (
                <section className="rounded-[28px] border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Histórico do plano</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Exibindo apenas os usos do seu plano no ciclo atual da assinatura.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {ultimosUsos.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0f0f0f] px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold">{item.titulo}</p>
                            <p className="mt-2 text-sm text-[var(--muted)]">{item.descricao}</p>
                          </div>
                          <span className="whitespace-nowrap text-xs text-[var(--muted)]">
                            {formatDateTimeValue(item.created_at)}
                          </span>
                        </div>
                        {item.detalhes ? (
                          <div className="mt-4">
                            {detalheAbertoId === item.id ? (
                              <div className="rounded-[20px] border border-white/10 bg-[#131313] p-3 sm:p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                                    Detalhes do uso
                                  </p>
                                  <span
                                    className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                                      getStatusLabel(item.detalhes.status_agendamento, item.detalhes.status_atendimento) === "Concluída"
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                        : "border-[var(--accent)]/35 bg-[var(--accent)]/12 text-[var(--accent-strong)]"
                                    }`}
                                  >
                                    {getStatusLabel(item.detalhes.status_agendamento, item.detalhes.status_atendimento)}
                                  </span>
                                </div>

                                <div className="mt-4 grid gap-3">
                                  <InlineDetailRow label="Dia" value={formatDateValue(item.detalhes.data)} />
                                  <InlineDetailRow
                                    label="Horário"
                                    value={`${formatHour(item.detalhes.hora_inicio)} até ${formatHour(item.detalhes.hora_fim)}`}
                                  />
                                  <InlineDetailRow label="Barbeiro" value={String(item.detalhes.barbeiro_nome ?? "-")} />
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setDetalheAbertoId((current) => (current === item.id ? null : item.id))}
                                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                              >
                                {detalheAbertoId === item.id ? "Ocultar detalhes" : "Ver detalhes"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101010] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function InlineDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101010] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function getStatusLabel(statusAgendamento?: StatusAgendamento | null, statusAtendimento?: string | null) {
  if (statusAgendamento === "no_show") {
    return "Não compareceu";
  }

  if (statusAtendimento === "concluido") {
    return "Concluída";
  }

  if (statusAgendamento === "cancelado") {
    return "Cancelada";
  }

  return "Registrada no plano";
}

function formatDateValue(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatarDataISO(value);
  }
  return value;
}

function formatDateTimeValue(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatHour(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}
