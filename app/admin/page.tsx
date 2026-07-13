"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { timeToMinutes } from "@/lib/agenda";
import { formatarDataISO, formatarHora, getTodayInputValue } from "@/lib/format";
import { canAdminCancelAppointment, hasAppointmentStarted } from "@/lib/agendamento-rules";
import type { StatusAgendamento, StatusAtendimento, StatusPagamento } from "@/lib/agendamento";
import { getWhatsAppLink } from "@/lib/whatsapp";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import { buildAgendaTimelineTimes, isExtraAgendaTimelineSlot } from "@/lib/agenda-timeline";
import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminMetric,
  AdminPageHeading,
  AdminPanel,
  AdminScopeNotice,
  AdminToast,
} from "@/app/admin/_components/AdminUi";
import { QuickAddModal } from "@/app/admin/_components/QuickAddModal";

type AgendaItem = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  celular_cliente: string;
  servico_nome: string;
  valor_final?: number;
  servico_preco?: number;
  status_agendamento?: StatusAgendamento;
  status_atendimento?: StatusAtendimento;
  status_pagamento?: StatusPagamento;
  tipo_cobranca?: string;
  origem?: "agendamento" | "horario_customizado";
};

type AdminMeResponse = {
  barbeiro: {
    id: string;
    nome: string;
    cargo: "socio" | "barbeiro";
  };
};

type BarbeiroOption = {
  id: string;
  nome: string;
};

type ViewMode = "dia" | "semana";

type StatusMeta = {
  statusLabel: string;
  pagamentoLabel: string | null;
  podeMarcarPago: boolean;
  podeGerenciarAtendimento: boolean;
  podeCancelar: boolean;
  isCustom: boolean;
};

type AdminConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "secondary" | "danger";
  onConfirm: () => Promise<void> | void;
};

type AgendaDayRow =
  | { hora: string; kind: "livre" }
  | { hora: string; kind: "ocupado"; item: AgendaItem }
  | { hora: string; kind: "inicio"; item: AgendaItem };

function isVisibleAgendaItem(item: AgendaItem) {
  return item.origem === "horario_customizado" || item.status_agendamento !== "cancelado";
}

function addDays(isoDate: string, amount: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getWeekRange(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const mondayIso = monday.toISOString().slice(0, 10);
  return {
    start: mondayIso,
    end: addDays(mondayIso, 6),
  };
}

function buildStatusMeta(item: AgendaItem, referenceDate = new Date()): StatusMeta {
  const isCustom = item.origem === "horario_customizado";
  const statusLabel = isCustom
    ? "Reserva manual"
    : item.status_atendimento === "concluido"
      ? "Concluído"
      : item.status_agendamento === "no_show"
        ? "Não compareceu"
        : item.status_agendamento === "cancelado"
          ? "Cancelado"
          : item.status_agendamento === "confirmado"
            ? "Confirmado"
            : "Agendado";

  const pagamentoLabel = isCustom
    ? null
    : item.tipo_cobranca === "plano"
      ? "Pago com plano"
      : item.status_pagamento === "pago"
        ? "Pago"
        : "Pendente";
  const podeGerenciarAtendimento =
    !isCustom &&
    item.status_agendamento !== "cancelado" &&
    item.status_agendamento !== "no_show" &&
    item.status_atendimento !== "concluido" &&
    hasAppointmentStarted(item, referenceDate);
  const podeMarcarPago =
    !isCustom &&
    item.status_agendamento !== "cancelado" &&
    item.status_agendamento !== "no_show" &&
    item.status_atendimento === "concluido" &&
    item.status_pagamento !== "pago";

  const podeCancelar = !isCustom && canAdminCancelAppointment(item);
  return { statusLabel, pagamentoLabel, podeMarcarPago, podeGerenciarAtendimento, podeCancelar, isCustom };
}

export default function AdminAgendaPage() {
  const today = getTodayInputValue();
  const tomorrow = addDays(today, 1);
  const [data, setData] = useState(today);
  const [modo, setModo] = useState<ViewMode>("dia");
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [adminCargo, setAdminCargo] = useState<"socio" | "barbeiro" | "">("");
  const [barbeiros, setBarbeiros] = useState<BarbeiroOption[]>([]);
  const [barbeiroId, setBarbeiroId] = useState("");
  const [contextLoading, setContextLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(() => new Date());
  const [erro, setErro] = useAutoDismissState();
  const [msg, setMsg] = useAutoDismissState();
  const [expandedAgendaItemId, setExpandedAgendaItemId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<AdminConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [quickAddSlot, setQuickAddSlot] = useState<{ hora: string } | null>(null);

  const carregarContexto = useCallback(async () => {
    setContextLoading(true);
    setErro("");

    try {
      const adminRes = await fetch("/api/admin/me", { cache: "no-store" });
      const adminJson = (await adminRes.json()) as AdminMeResponse & { erro?: string };

      if (!adminRes.ok) {
        throw new Error(adminJson.erro || "Erro ao carregar sessão administrativa.");
      }

      const admin = adminJson.barbeiro;
      setAdminCargo(admin.cargo);

      if (admin.cargo === "socio") {
        const barbeirosRes = await fetch("/api/barbeiros", { cache: "no-store" });
        const barbeirosJson = (await barbeirosRes.json()) as { barbeiros?: BarbeiroOption[]; erro?: string };

        if (!barbeirosRes.ok) {
          throw new Error(barbeirosJson.erro || "Erro ao carregar barbeiros.");
        }

        const options = barbeirosJson.barbeiros ?? [];
        setBarbeiros(options);
        setBarbeiroId((current) => current || admin.id);
      } else {
        setBarbeiros([{ id: admin.id, nome: admin.nome }]);
        setBarbeiroId(admin.id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao preparar a agenda.");
    } finally {
      setContextLoading(false);
    }
  }, [setErro]);

  const carregarAgenda = useCallback(async () => {
    if (contextLoading) {
      return;
    }

    if (!barbeiroId) {
      setAgenda([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const search = new URLSearchParams({ barbeiro_id: barbeiroId });
      if (modo === "dia") {
        search.set("data", data);
      } else {
        const range = getWeekRange(data);
        search.set("date_from", range.start);
        search.set("date_to", range.end);
      }

      const res = await fetch(`/api/admin-agenda?${search.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar agenda.");
      }

      setAgenda(json ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  }, [barbeiroId, contextLoading, data, modo, setErro]);


  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAgora(new Date());
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    void carregarContexto();
  }, [carregarContexto]);

  useEffect(() => {
    void carregarAgenda();
  }, [carregarAgenda]);

  useEffect(() => {
    setExpandedAgendaItemId(null);
  }, [agenda, modo, data, barbeiroId]);

  const resumo = useMemo(() => {
    const agendamentos = agenda
      .filter(isVisibleAgendaItem)
      .filter((item) => item.origem !== "horario_customizado");
    const concluidosPagos = agendamentos.filter(
      (item) => item.status_atendimento === "concluido" && item.status_pagamento === "pago"
    );

    return {
      total: agendamentos.length,
      concluidos: agendamentos.filter((item) => item.status_atendimento === "concluido").length,
      receitaGerada: concluidosPagos.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0),
      receitaEsperada: agendamentos
        .filter((item) => item.status_agendamento !== "cancelado" && item.status_agendamento !== "no_show")
        .reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0),
    };
  }, [agenda]);

  const agendaVisivel = useMemo(() => agenda.filter(isVisibleAgendaItem), [agenda]);

  const barbeiroSelecionado = useMemo(
    () => barbeiros.find((item) => item.id === barbeiroId) ?? null,
    [barbeiroId, barbeiros]
  );

  const weekRange = useMemo(() => getWeekRange(data), [data]);
  const agendaOrdenada = useMemo(
    () => [...agendaVisivel].sort((a, b) => `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`)),
    [agendaVisivel]
  );
  const agendaPorDia = useMemo(() => {
    const groups = new Map<string, AgendaItem[]>();

    for (const item of agendaOrdenada) {
      const lista = groups.get(item.data) ?? [];
      lista.push(item);
      groups.set(item.data, lista);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, itens]) => ({
        dia,
        itens: [...itens].sort((a, b) => `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`)),
      }));
  }, [agendaOrdenada]);
  const agendaDiaLinhas = useMemo<AgendaDayRow[]>(() => {
    if (modo !== "dia") {
      return [];
    }

    const day = new Date(`${data}T00:00:00`).getDay();
    const itensDoDia = agendaOrdenada.filter((item) => item.data === data);
    const timelineTimes = buildAgendaTimelineTimes(day, itensDoDia);

    if (timelineTimes.length === 0) {
      return [];
    }

    const linhas: AgendaDayRow[] = [];

    for (const hora of timelineTimes) {
      const minuto = timeToMinutes(hora);
      const itemInicial = itensDoDia.find((item) => timeToMinutes(item.hora_inicio) === minuto);
      if (itemInicial) {
        linhas.push({ hora, kind: "inicio", item: itemInicial });
        continue;
      }

      const itemOcupado = itensDoDia.find(
        (item) => timeToMinutes(item.hora_inicio) < minuto && timeToMinutes(item.hora_fim) > minuto
      );

      if (itemOcupado) {
        linhas.push({ hora, kind: "ocupado", item: itemOcupado });
        continue;
      }

      linhas.push({ hora, kind: "livre" });
    }

    return linhas;
  }, [agendaOrdenada, data, modo]);

  async function atualizarAgendamento(id: string, payload: Record<string, string>) {
    setErro("");
    setMsg("");

    const res = await fetch("/api/admin-agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao atualizar agendamento.");
      return;
    }

    setMsg("Agenda atualizada com sucesso.");
    await carregarAgenda();
  }

  async function cancelarAgendamento(id: string) {
    setErro("");
    setMsg("");

    const res = await fetch("/api/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, admin: true }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao cancelar agendamento.");
      return;
    }

    setMsg("Agendamento cancelado.");
    await carregarAgenda();
  }

  async function confirmarAcaoPendente() {
    if (!confirmState) {
      return;
    }

    setConfirmLoading(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  function solicitarConclusao(item: AgendaItem) {
    setConfirmState({
      title: "Concluir atendimento",
      description: "Esse horario sera marcado como concluido e entrara normalmente no fechamento do barbeiro.",
      confirmLabel: "Concluir atendimento",
      tone: "primary",
      onConfirm: () => atualizarAgendamento(item.id, { status_atendimento: "concluido" }),
    });
  }

  function solicitarFalta(item: AgendaItem) {
    setConfirmState({
      title: "Marcar falta do cliente",
      description: "Use essa acao apenas quando o cliente realmente nao compareceu. Isso pode consumir saldo de plano e altera o historico do atendimento.",
      confirmLabel: "Confirmar falta",
      tone: "secondary",
      onConfirm: () => atualizarAgendamento(item.id, { status_agendamento: "no_show" }),
    });
  }

  function solicitarCancelamento(item: AgendaItem) {
    setConfirmState({
      title: "Cancelar agendamento",
      description: "Esse horario sera removido da agenda do barbeiro e o cliente pode ter credito devolvido quando aplicavel.",
      confirmLabel: "Cancelar horario",
      tone: "danger",
      onConfirm: () => cancelarAgendamento(item.id),
    });
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Agenda"
        title={modo === "dia" ? "Agenda do dia" : "Agenda da semana"}
        actions={
          <>
            <Link href="/admin/marcar" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Marcar horário
            </Link>
            <Link href="/admin/bloqueios" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Bloqueios
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-3 xl:flex-1">
          <AdminMetric compact label="Agendados" value={String(resumo.total)} />
          <AdminMetric compact label="Concluídos" value={String(resumo.concluidos)} />
          <AdminMetric
            compact
            label="Receita prevista"
            value={resumo.receitaEsperada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            note={`Recebida ${resumo.receitaGerada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
          />
        </div>

        <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 xl:min-w-[360px]">
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">Visualizacao</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModo("dia")}
                className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${
                  modo === "dia"
                    ? "bg-[var(--accent)] text-black"
                    : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                }`}
              >
                Dia
              </button>
              <button
                type="button"
                onClick={() => setModo("semana")}
                className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${
                  modo === "semana"
                    ? "bg-[var(--accent)] text-black"
                    : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                }`}
              >
                Semana
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[var(--muted)]">
              {modo === "dia" ? "Dia da agenda" : "Semana de referencia"}
            </label>
            {modo === "dia" ? (
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setData(today)}
                  className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                    data === today
                      ? "bg-[var(--accent)] text-black"
                      : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setData(tomorrow)}
                  className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                    data === tomorrow
                      ? "bg-[var(--accent)] text-black"
                      : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                  }`}
                >
                  Amanhã
                </button>
              </div>
            ) : null}
            <input
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="datetime-input w-full rounded-2xl border px-4 py-3"
            />
          </div>

          {adminCargo === "socio" ? (
            <div>
              <label className="mb-2 block text-sm text-[var(--muted)]">Barbeiro</label>
              <select
                value={barbeiroId}
                onChange={(event) => setBarbeiroId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white"
                style={{ colorScheme: "dark" }}
              >
                {barbeiros.map((barbeiro) => (
                  <option key={barbeiro.id} value={barbeiro.id} style={{ backgroundColor: "#f4efe4", color: "#111" }}>
                    {barbeiro.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {modo === "semana" ? (
            <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--muted)]">
              {formatarDataISO(weekRange.start)} ate {formatarDataISO(weekRange.end)}
            </div>
          ) : null}
        </div>
      </div>

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}
      {msg ? <AdminToast tone="success">{msg}</AdminToast> : null}
      {adminCargo === "socio" && barbeiroSelecionado ? (
        <div className="mb-6">
          <AdminScopeNotice title={`Agenda de ${barbeiroSelecionado.nome}.`} />
        </div>
      ) : null}

      <AdminPanel title={modo === "dia" ? "Compromissos do dia" : "Semana de atendimentos"}>
        {contextLoading || loading ? <p className="text-[var(--muted)]">Carregando agenda...</p> : null}

        {!contextLoading && !loading && modo === "semana" && agendaVisivel.length === 0 ? (
          <p className="text-[var(--muted)]">Nenhum compromisso para esta semana.</p>
        ) : null}

        {!contextLoading && !loading && modo === "dia" ? (
          <AgendaTableDay
            linhas={agendaDiaLinhas}
            expandedItemId={expandedAgendaItemId}
            onToggleItem={(id) => setExpandedAgendaItemId((current) => (current === id ? null : id))}
            onConcluir={solicitarConclusao}
            onMarcarFalta={solicitarFalta}
            onMarcarPago={(item) => void atualizarAgendamento(item.id, { status_pagamento: "pago" })}
            agora={agora}
            onCancelar={solicitarCancelamento}
            onQuickAdd={(hora) => setQuickAddSlot({ hora })}
          />
        ) : null}

        {!contextLoading && !loading && agendaVisivel.length > 0 && modo === "semana" ? (
          <div className="space-y-4">
            {agendaPorDia.map(({ dia, itens }) => (
              <section key={dia} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatarDataISO(dia)}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{itens.length} compromisso(s)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {itens.map((item) => {
                    const expanded = expandedAgendaItemId === item.id;
                    const meta = buildStatusMeta(item, agora);
                    const whatsappLink = getWhatsAppLink(item.celular_cliente, `Olá ${item.nome_cliente}, sobre seu horário na Império Ferreira.`);

                    return (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedAgendaItemId((current) => (current === item.id ? null : item.id))}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
                        >
                          <div className="min-w-[68px] text-sm font-semibold text-[var(--accent-strong)]">
                            {formatarHora(item.hora_inicio)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-white">{item.nome_cliente}</p>
                            <p className="truncate text-sm text-[var(--muted)]">{item.servico_nome}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                            {meta.statusLabel}
                          </span>
                        </button>

                        {expanded ? (
                          <div className="border-t border-white/10 px-3 py-3">
                            <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
                              <p>Cliente: <span className="text-white">{item.nome_cliente}</span></p>
                              <p>Serviço: <span className="text-white">{item.servico_nome}</span></p>
                              <p>Horário: <span className="text-white">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</span></p>
                              {meta.pagamentoLabel ? <p>Pagamento: <span className="text-white">{meta.pagamentoLabel}</span></p> : null}
                            </div>

                            {!meta.isCustom ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {meta.podeGerenciarAtendimento ? (
                                  <AdminActionButton onClick={() => solicitarConclusao(item)}>
                                    Concluir
                                  </AdminActionButton>
                                ) : null}
                                {whatsappLink ? (
                                  <a href={whatsappLink} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]">
                                    WhatsApp
                                  </a>
                                ) : null}
                                {meta.podeMarcarPago ? (
                                  <AdminActionButton tone="secondary" onClick={() => atualizarAgendamento(item.id, { status_pagamento: "pago" })}>
                                    Marcar como pago
                                  </AdminActionButton>
                                ) : null}
                                {meta.podeGerenciarAtendimento ? (
                                  <AdminActionButton tone="secondary" onClick={() => solicitarFalta(item)}>
                                    Marcar falta
                                  </AdminActionButton>
                                ) : null}
                                {item.status_agendamento !== "cancelado" ? (
                                  <AdminActionButton tone="danger" disabled={!meta.podeCancelar} className="disabled:border-white/10 disabled:text-[var(--muted)] disabled:hover:bg-transparent disabled:saturate-0" onClick={() => solicitarCancelamento(item)}>
                                    Cancelar
                                  </AdminActionButton>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </AdminPanel>

      {quickAddSlot && barbeiroId ? (
        <QuickAddModal
          data={data}
          horaInicio={quickAddSlot.hora}
          barbeiroId={barbeiroId}
          barbeiroNome={barbeiroSelecionado?.nome}
          onClose={() => setQuickAddSlot(null)}
          onSuccess={() => {
            setQuickAddSlot(null);
            void carregarAgenda();
          }}
        />
      ) : null}

      <AdminConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        description={confirmState?.description ?? ""}
        confirmLabel={confirmState?.confirmLabel ?? "Confirmar"}
        tone={confirmState?.tone ?? "danger"}
        loading={confirmLoading}
        onClose={() => {
          if (!confirmLoading) {
            setConfirmState(null);
          }
        }}
        onConfirm={() => void confirmarAcaoPendente()}
      />
    </>
  );
}

function AgendaTableDay({
  linhas,
  expandedItemId,
  onToggleItem,
  onConcluir,
  onMarcarFalta,
  onMarcarPago,
  onCancelar,
  onQuickAdd,
  agora,
}: {
  linhas: AgendaDayRow[];
  expandedItemId: string | null;
  onToggleItem: (id: string) => void;
  onConcluir: (item: AgendaItem) => void;
  onMarcarFalta: (item: AgendaItem) => void;
  onMarcarPago: (item: AgendaItem) => void;
  agora: Date;
  onCancelar: (item: AgendaItem) => void;
  onQuickAdd: (hora: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
      <div className="grid grid-cols-[74px_minmax(0,1fr)] border-b border-white/10 bg-white/[0.03]">
        <div className="px-3 py-3 text-[11px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">Hora</div>
        <div className="border-l border-white/10 px-3 py-3 text-[11px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">Agenda</div>
      </div>

      {linhas.map((linha) => (
        <div
          key={linha.hora}
          className={`grid min-w-0 grid-cols-[74px_minmax(0,1fr)] border-b border-white/10 last:border-b-0 ${
            isExtraAgendaTimelineSlot(linha.hora) ? "min-h-[52px]" : "min-h-[76px]"
          }`}
        >
          <div className={`px-3 text-sm font-semibold text-[var(--accent-strong)] ${isExtraAgendaTimelineSlot(linha.hora) ? "py-2" : "py-3"}`}>{linha.hora}</div>
          <div className={`min-w-0 border-l border-white/10 px-2 sm:px-3 ${isExtraAgendaTimelineSlot(linha.hora) ? "py-1.5" : "py-2"}`}>
            {linha.kind === "livre" ? (
              <div className={`flex w-full items-center justify-between gap-2 rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-3 text-left transition hover:bg-[var(--accent)]/5 ${isExtraAgendaTimelineSlot(linha.hora) ? "py-2" : "py-3"}`}>
                <span className="text-sm text-[var(--muted)]">Horário livre</span>
                <button
                  type="button"
                  onClick={() => onQuickAdd(linha.hora)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/10 hover:text-[var(--accent-strong)]"
                >
                  Agendar
                </button>
              </div>
            ) : linha.kind === "ocupado" ? (
              <div className={`px-3 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]/85 ${isExtraAgendaTimelineSlot(linha.hora) ? "py-2" : "py-3"}`}>
                Em andamento até {formatarHora(linha.item.hora_fim)}
              </div>
            ) : (
              <AgendaStartCard
                item={linha.item}
                expanded={expandedItemId === linha.item.id}
                onToggle={() => onToggleItem(linha.item.id)}
                onConcluir={() => onConcluir(linha.item)}
                onMarcarFalta={() => onMarcarFalta(linha.item)}
                onMarcarPago={() => onMarcarPago(linha.item)}
                agora={agora}
                onCancelar={() => onCancelar(linha.item)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgendaStartCard({
  item,
  expanded,
  onToggle,
  onConcluir,
  onMarcarFalta,
  onMarcarPago,
  onCancelar,
  agora,
}: {
  item: AgendaItem;
  expanded: boolean;
  onToggle: () => void;
  onConcluir: () => void;
  onMarcarFalta: () => void;
  onMarcarPago: () => void;
  agora: Date;
  onCancelar: () => void;
}) {
  const meta = buildStatusMeta(item, agora);
  const whatsappLink = getWhatsAppLink(item.celular_cliente, `Olá ${item.nome_cliente}, sobre seu horário na Império Ferreira.`);

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[rgba(4,7,6,0.82)]">
      <button type="button" onClick={onToggle} className="w-full min-w-0 px-3 py-3 text-left hover:bg-white/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-base font-semibold text-white">{item.servico_nome}</p>
            <p className="mt-1 break-words text-sm text-[var(--muted)]">{item.nome_cliente}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              {meta.statusLabel}
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-white/10 px-3 py-3">
          <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 xl:grid-cols-4">
            <p>Cliente: <span className="text-white">{item.nome_cliente}</span></p>
            <p>Serviço: <span className="text-white">{item.servico_nome}</span></p>
            <p>Horário: <span className="text-white">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</span></p>
            {meta.pagamentoLabel ? <p>Pagamento: <span className="text-white">{meta.pagamentoLabel}</span></p> : null}
          </div>

          {!meta.isCustom ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {meta.podeGerenciarAtendimento ? (
                <AdminActionButton onClick={onConcluir}>
                  Concluir
                </AdminActionButton>
              ) : null}
              {whatsappLink ? (
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]">
                  WhatsApp
                </a>
              ) : null}
              {meta.podeMarcarPago ? (
                <AdminActionButton tone="secondary" onClick={onMarcarPago}>
                  Marcar como pago
                </AdminActionButton>
              ) : null}
              {meta.podeGerenciarAtendimento ? (
                <AdminActionButton tone="secondary" onClick={onMarcarFalta}>
                  Marcar falta
                </AdminActionButton>
              ) : null}
              {item.status_agendamento !== "cancelado" ? (
                <AdminActionButton tone="danger" disabled={!meta.podeCancelar} className="disabled:border-white/10 disabled:text-[var(--muted)] disabled:hover:bg-transparent disabled:saturate-0" onClick={onCancelar}>
                  Cancelar
                </AdminActionButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}









