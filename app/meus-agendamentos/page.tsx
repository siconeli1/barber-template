"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatarDataISO, formatarHora, formatarCelular } from "@/lib/format";
import { canCancelAppointment } from "@/lib/agendamento-rules";
import type { StatusAgendamento, StatusAtendimento } from "@/lib/agendamento";
import { NoticeToast } from "@/app/_components/NoticeToast";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { SkeletonAgendamentoCard } from "@/app/_components/Skeleton";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import { normalizePhone } from "@/lib/phone";
import { useCustomerSession } from "@/lib/use-customer-session";

type Agendamento = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  cancelavel_ate?: string | null;
  servico_nome?: string;
  servico_preco?: number;
  valor_final?: number;
  status_agendamento?: StatusAgendamento;
  status_atendimento?: StatusAtendimento;
  barbeiros?: { nome?: string | null } | { nome?: string | null }[] | null;
};

export default function MeusAgendamentosPage() {
  const { profile, sessionReady, signIn, signOut } = useCustomerSession();
  const [telefoneInput, setTelefoneInput] = useState("");
  const [telefoneConsulta, setTelefoneConsulta] = useState("");
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [aba, setAba] = useState<"ativos" | "passados">("ativos");
  const [erro, setErro] = useAutoDismissState();
  const [msg, setMsg] = useAutoDismissState();
  const [loading, setLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(true);
  const [agora, setAgora] = useState(() => new Date());
  const [itemParaCancelar, setItemParaCancelar] = useState<Agendamento | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAgora(new Date());
    }, 15000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const buscarAgendamentos = useCallback(async (tel: string) => {
    const telNorm = normalizePhone(tel);
    if (!telNorm) return;

    setLoading(true);
    setLoadFailed(false);
    setErro("");
    setMsg("");

    try {
      const res = await fetch(`/api/meus-agendamentos?telefone=${encodeURIComponent(telNorm)}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao buscar agendamentos.");
        setLoadFailed(true);
        setAgendamentos([]);
        return;
      }

      setProfileExists(json.profile_exists !== false);
      setAgendamentos(json.agendamentos ?? []);
      setTelefoneConsulta(telNorm);
    } catch {
      setErro("Erro ao conectar com o servidor.");
      setLoadFailed(true);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [setErro, setMsg]);

  useEffect(() => {
    if (!sessionReady || !profile?.telefone) {
      return;
    }

    if (telefoneConsulta === profile.telefone) {
      return;
    }

    void buscarAgendamentos(profile.telefone);
  }, [buscarAgendamentos, profile, sessionReady, telefoneConsulta]);

  async function handleSubmitTelefone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const telNorm = normalizePhone(telefoneInput);
    if (!telNorm) return;

    setErro("");
    setMsg("");
    setProfileExists(true);
    setLoadFailed(false);

    const { error } = await signIn(telNorm);

    if (error) {
      if (error.message.includes("nome") || error.message.includes("cadastro")) {
        setTelefoneConsulta(telNorm);
        setProfileExists(false);
        setAgendamentos([]);
        return;
      }

      setErro(error.message);
      return;
    }

    await buscarAgendamentos(telNorm);
  }

  async function confirmarCancelamento() {
    if (!itemParaCancelar || !telefoneConsulta) return;

    setCancelando(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch("/api/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemParaCancelar.id, telefone: telefoneConsulta }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro || "Erro ao cancelar agendamento.");
        return;
      }

      setMsg("Agendamento cancelado com sucesso.");
      setItemParaCancelar(null);
      await buscarAgendamentos(telefoneConsulta);
    } catch {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setCancelando(false);
    }
  }

  function solicitarCancelamento(item: Agendamento) {
    if (!canCancelAppointment(item, agora)) {
      setErro("Este agendamento nao pode mais ser cancelado.");
      return;
    }
    if (!telefoneConsulta) {
      setErro("Consulte seus agendamentos primeiro.");
      return;
    }
    setItemParaCancelar(item);
  }

  function resolveBarbeiroNome(item: Agendamento) {
    if (Array.isArray(item.barbeiros)) {
      return item.barbeiros[0]?.nome ?? "Barbeiro";
    }
    return item.barbeiros?.nome ?? "Barbeiro";
  }

  const agendamentosAtivos = useMemo(() => {
    return [...agendamentos]
      .filter(
        (item) =>
          item.status_agendamento !== "cancelado" &&
          item.status_agendamento !== "no_show" &&
          item.status_atendimento !== "concluido"
      )
      .sort((a, b) => `${a.data}T${a.hora_inicio}`.localeCompare(`${b.data}T${b.hora_inicio}`));
  }, [agendamentos]);

  const agendamentosPassados = useMemo(() => {
    return [...agendamentos]
      .filter(
        (item) =>
          item.status_agendamento === "cancelado" ||
          item.status_agendamento === "no_show" ||
          item.status_atendimento === "concluido"
      )
      .sort((a, b) => `${b.data}T${b.hora_inicio}`.localeCompare(`${a.data}T${a.hora_inicio}`))
      .slice(0, 5);
  }, [agendamentos]);

  const proximoAgendamentoId = agendamentosAtivos[0]?.id ?? null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <ConfirmDialog
        open={itemParaCancelar !== null}
        onCancel={() => setItemParaCancelar(null)}
        onConfirm={confirmarCancelamento}
        title="Cancelar agendamento"
        description="Essa acao libera o horario para a agenda. Tem certeza que deseja cancelar?"
        confirmLabel="Sim, cancelar"
        tone="danger"
        loading={cancelando}
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 border-b border-white/10 pb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white">
            <span aria-hidden="true">←</span> Inicio
          </Link>
          <div className="mt-6 max-w-2xl">
            <h1 className="text-4xl font-semibold">Meus agendamentos</h1>
            <p className="mt-3 text-lg text-[var(--muted)]">
              Consulte, acompanhe e cancele suas reservas usando o mesmo numero informado no agendamento.
            </p>
          </div>
        </div>

        {erro ? <NoticeToast tone="danger">{erro}</NoticeToast> : null}
        {msg ? <NoticeToast tone="success">{msg}</NoticeToast> : null}

        {!sessionReady ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <SkeletonAgendamentoCard key={i} />
            ))}
          </div>
        ) : null}

        {sessionReady && !profile ? (
          <section className="animate-fade-in-up rounded-[32px] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold">Informe seu celular</h2>
            <p className="mt-3 text-[var(--muted)]">
              Digite o numero usado anteriormente para abrir seus agendamentos.
            </p>
            <form onSubmit={handleSubmitTelefone} className="mt-6 flex flex-col gap-4 sm:flex-row">
              <input
                type="tel"
                value={telefoneInput}
                onChange={(e) => setTelefoneInput(formatarCelular(e.target.value))}
                placeholder="(17) 99999-9999"
                maxLength={15}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/30"
              />
              <button
                type="submit"
                disabled={loading || !telefoneInput}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                {loading ? "Buscando..." : "Consultar"}
              </button>
            </form>
          </section>
        ) : null}

        {profile ? (
          <section className="space-y-4 animate-fade-in-up">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">Consultando como</p>
                  <p className="mt-1 text-lg font-semibold text-white">{profile.nome}</p>
                  <p className="text-sm text-[var(--muted)]">{profile.telefone}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {loadFailed ? (
                    <button
                      type="button"
                      onClick={() => void buscarAgendamentos(profile.telefone)}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
                    >
                      Tentar novamente
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setTelefoneConsulta("");
                      setTelefoneInput("");
                      setAgendamentos([]);
                      setProfileExists(true);
                      setLoadFailed(false);
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-white/10 hover:text-white"
                  >
                    Trocar cadastro
                  </button>
                </div>
              </div>
            </div>

            {!profileExists && !loading ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="text-lg font-semibold text-white">Cadastro nao encontrado</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Este numero ainda nao possui agendamentos registrados.</p>
                <div className="mt-5">
                  <Link
                    href="/agendar"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
                  >
                    Fazer meu primeiro agendamento
                  </Link>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <SkeletonAgendamentoCard key={i} />
                ))}
              </div>
            ) : null}

            {!loading && profileExists && agendamentos.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center">
                <p className="text-2xl">✂️</p>
                <p className="mt-4 text-lg font-semibold text-white">Nenhum agendamento encontrado</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Voce ainda nao tem agendamentos registrados neste numero.</p>
                <div className="mt-6">
                  <Link
                    href="/agendar"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
                  >
                    Agendar agora
                  </Link>
                </div>
              </div>
            ) : null}

            {!loading && profileExists && agendamentos.length > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setAba("ativos")}
                    className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                      aba === "ativos"
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/15 text-white hover:bg-white/10"
                    }`}
                  >
                    Agendamentos ativos
                    {agendamentosAtivos.length > 0 ? (
                      <span className={`ml-2 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${aba === "ativos" ? "bg-black/20 text-black" : "bg-white/10 text-white"}`}>
                        {agendamentosAtivos.length}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAba("passados")}
                    className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                      aba === "passados"
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/15 text-white hover:bg-white/10"
                    }`}
                  >
                    Historico
                  </button>
                </div>

                {aba === "ativos" ? (
                  agendamentosAtivos.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center">
                      <p className="text-[var(--muted)]">Nenhum agendamento ativo no momento.</p>
                      <div className="mt-4">
                        <Link
                          href="/agendar"
                          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
                        >
                          Fazer novo agendamento
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {agendamentosAtivos.map((item) => (
                        <AgendamentoCard
                          key={item.id}
                          item={item}
                          barbeiroNome={resolveBarbeiroNome(item)}
                          loading={loading}
                          agora={agora}
                          isProximo={item.id === proximoAgendamentoId}
                          onCancelar={solicitarCancelamento}
                        />
                      ))}
                    </div>
                  )
                ) : agendamentosPassados.length === 0 ? (
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                    Nenhum historico de agendamentos ainda.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agendamentosPassados.map((item) => (
                      <AgendamentoCard
                        key={item.id}
                        item={item}
                        barbeiroNome={resolveBarbeiroNome(item)}
                        loading={loading}
                        agora={agora}
                        isProximo={false}
                        onCancelar={solicitarCancelamento}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function AgendamentoCard({
  item,
  barbeiroNome,
  loading,
  onCancelar,
  agora,
  isProximo,
}: {
  item: Agendamento;
  barbeiroNome: string;
  loading: boolean;
  agora: Date;
  isProximo: boolean;
  onCancelar: (item: Agendamento) => void;
}) {
  const cancelado = item.status_agendamento === "cancelado";
  const noShow = item.status_agendamento === "no_show";
  const concluido = item.status_atendimento === "concluido";
  const podeCancelar = canCancelAppointment(item, agora);
  const statusLabel = cancelado ? "Cancelado" : noShow ? "Não compareceu" : concluido ? "Concluido" : "Agendado";

  return (
    <div
      className={`rounded-[28px] border p-6 transition ${
        isProximo
          ? "border-[var(--accent)]/40 bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.07),rgba(0,0,0,0.2))]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {isProximo ? (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            <span className="size-1.5 rounded-full bg-[var(--accent-strong)]" />
            Proximo agendamento
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xl font-semibold">{formatarDataISO(item.data)}</p>
          <p className="mt-2 text-[var(--muted)]">
            {formatarHora(item.hora_inicio)} ate {formatarHora(item.hora_fim)}
          </p>
          <p className="mt-4 text-white">{item.servico_nome || "Servico nao informado"}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Barbeiro: {barbeiroNome}</p>
        </div>
        <div className="text-left sm:text-right">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
              cancelado
                ? "border-red-500/30 text-red-400"
                : noShow
                  ? "border-amber-500/30 text-amber-300"
                : concluido
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-white/10 text-[var(--accent-strong)]"
            }`}
          >
            {statusLabel}
          </span>
          <p className="mt-3 text-lg font-semibold">
            {Number(item.valor_final ?? item.servico_preco ?? 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
      </div>

      {!cancelado && !concluido ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onCancelar(item)}
            disabled={loading || !podeCancelar}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-[var(--muted)] disabled:opacity-60"
          >
            Cancelar agendamento
          </button>
          {!podeCancelar ? (
            <p className="text-xs text-[var(--muted)]">Indisponivel nas ultimas 2h antes do horario.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
