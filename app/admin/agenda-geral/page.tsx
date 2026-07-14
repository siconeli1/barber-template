"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { timeToMinutes } from "@/lib/agenda";
import { formatarDataISO, formatarHora, getTodayInputValue } from "@/lib/format";
import { canAdminCancelAppointment, hasAppointmentStarted } from "@/lib/agendamento-rules";
import type { StatusAgendamento, StatusAtendimento, StatusPagamento } from "@/lib/agendamento";
import { getWhatsAppLink } from "@/lib/whatsapp";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import { AdminActionButton, AdminConfirmDialog, AdminToast } from "@/app/admin/_components/AdminUi";
import { QuickAddModal } from "@/app/admin/_components/QuickAddModal";
import { buildAgendaTimelineTimes, getAgendaTimelineRowSpan, isExtraAgendaTimelineSlot } from "@/lib/agenda-timeline";
import barbershop from "@/barbershop.config";

type BarbeiroColumn = {
  id: string;
  nome: string;
  ordem: number;
};

type AgendaItem = {
  id: string;
  barbeiro_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  celular_cliente: string;
  servico_nome: string;
  valor_final?: number;
  status_agendamento?: StatusAgendamento;
  status_atendimento?: StatusAtendimento;
  status_pagamento?: StatusPagamento;
  tipo_cobranca?: string;
  origem?: "agendamento" | "horario_customizado";
};

type AgendaGeralResponse = {
  barbeiros: BarbeiroColumn[];
  agenda: AgendaItem[];
  data: string;
};

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

function isVisibleAgendaItem(item: AgendaItem) {
  return item.origem === "horario_customizado" || item.status_agendamento !== "cancelado";
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

function getSlotTimes(date: string, items: AgendaItem[]) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return buildAgendaTimelineTimes(day, items);
}

export default function AdminAgendaGeralPage() {
  const router = useRouter();
  const today = getTodayInputValue();
  const [selectedDate, setSelectedDate] = useState(today);
  const [barbeiros, setBarbeiros] = useState<BarbeiroColumn[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(() => new Date());
  const [erro, setErro] = useAutoDismissState();
  const [msg, setMsg] = useAutoDismissState();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<AdminConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [quickAddSlot, setQuickAddSlot] = useState<{ hora: string; barbeiroId: string; barbeiroNome: string } | null>(null);

  const carregarAgenda = useCallback(async () => {
    setErro("");

    try {
      const res = await fetch(`/api/admin-agenda-geral?data=${encodeURIComponent(selectedDate)}`, { cache: "no-store" });
      const json = (await res.json()) as AgendaGeralResponse & { erro?: string };

      if (res.status === 401 || res.status === 403) {
        router.replace("/admin");
        return;
      }

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar agenda geral.");
      }

      setBarbeiros(json.barbeiros ?? []);
      setAgenda(json.agenda ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda geral.");
    } finally {
      setLoading(false);
    }
  }, [router, selectedDate, setErro]);

  useEffect(() => {
    void carregarAgenda();
  }, [carregarAgenda]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      void carregarAgenda();
    }, 15000);
    const clockId = window.setInterval(() => {
      setAgora(new Date());
    }, 15000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void carregarAgenda();
        setAgora(new Date());
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(clockId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [carregarAgenda]);

  // Lock body scroll when fullscreen is active
  useEffect(() => {
    if (telaCheia) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [telaCheia]);

  const agendaVisivel = useMemo(() => agenda.filter(isVisibleAgendaItem), [agenda]);
  const horarios = useMemo(() => getSlotTimes(selectedDate, agendaVisivel), [agendaVisivel, selectedDate]);
  const barbersById = useMemo(() => new Map(barbeiros.map((item) => [item.id, item])), [barbeiros]);
  const agendaOrdenada = useMemo(
    () => [...agendaVisivel].sort((a, b) => {
      const barberOrder = (barbersById.get(a.barbeiro_id)?.ordem ?? 99) - (barbersById.get(b.barbeiro_id)?.ordem ?? 99);
      if (barberOrder !== 0) {
        return barberOrder;
      }
      return `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`);
    }),
    [agendaVisivel, barbersById]
  );

  const gridBlocks = useMemo(() => {
    const rowIndexByTime = new Map(horarios.map((hora, index) => [timeToMinutes(hora), index]));

    return agendaOrdenada
      .map((item) => {
        const barberIndex = barbeiros.findIndex((barbeiro) => barbeiro.id === item.barbeiro_id);
        const startIndex = rowIndexByTime.get(timeToMinutes(item.hora_inicio));

        if (barberIndex === -1 || startIndex === undefined) {
          return null;
        }

        return {
          item,
          barberIndex,
          rowStart: startIndex + 2,
          rowSpan: getAgendaTimelineRowSpan(horarios, item.hora_inicio, item.hora_fim),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [agendaOrdenada, barbeiros, horarios]);

  const highlightedGridCells = useMemo(() => {
    const marked = new Set<string>();

    for (const block of gridBlocks) {
      for (let offset = 0; offset < block.rowSpan; offset += 1) {
        marked.add(`${block.barberIndex}-${block.rowStart + offset - 2}`);
      }
    }

    return marked;
  }, [gridBlocks]);

  const selectedItem = useMemo(
    () => agendaVisivel.find((item) => item.id === selectedItemId) ?? null,
    [agendaVisivel, selectedItemId]
  );

  useEffect(() => {
    setSelectedItemId(null);
  }, [selectedDate]);

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
    setSelectedItemId(null);
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
    setSelectedItemId(null);
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
      description: "Esse horario sera marcado como concluido e seguira para o fechamento normal do barbeiro.",
      confirmLabel: "Concluir atendimento",
      tone: "primary",
      onConfirm: () => atualizarAgendamento(item.id, { status_atendimento: "concluido" }),
    });
  }

  function solicitarFalta(item: AgendaItem) {
    setConfirmState({
      title: "Marcar falta do cliente",
      description: "Use essa acao apenas quando o cliente realmente nao compareceu. Isso pode consumir saldo de plano e altera o historico do horario.",
      confirmLabel: "Confirmar falta",
      tone: "secondary",
      onConfirm: () => atualizarAgendamento(item.id, { status_agendamento: "no_show" }),
    });
  }

  function solicitarCancelamento(item: AgendaItem) {
    setConfirmState({
      title: "Cancelar agendamento",
      description: "Esse horario sera removido da agenda e pode devolver credito de plano ou abrir novamente a vaga do barbeiro.",
      confirmLabel: "Cancelar horario",
      tone: "danger",
      onConfirm: () => cancelarAgendamento(item.id),
    });
  }

  const gridSharedProps = {
    barbeiros,
    horarios,
    highlightedGridCells,
    gridBlocks,
    agora,
    selectedDate,
    today,
    onSelectItem: setSelectedItemId,
    onQuickAdd: (hora: string, barbeiroId: string) => {
      const barbeiro = barbeiros.find((b) => b.id === barbeiroId);
      setQuickAddSlot({ hora, barbeiroId, barbeiroNome: barbeiro?.nome ?? "" });
    },
  };

  return (
    <>
      {/* Normal view header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          aria-label="Voltar"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[0px] font-semibold text-transparent hover:bg-white/[0.08]"
        >
          <span className="text-sm text-white">{"\u2190"} Voltar</span>
          ← Voltar
        </Link>
        <div className="flex items-center gap-2">
          {horarios.length > 0 ? (
            <button
              type="button"
              onClick={() => setTelaCheia(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" />
              </svg>
              Tela cheia
            </button>
          ) : null}
          <label className="relative inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-[var(--accent-strong)]">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.25 2.25 0 0118 6.25v9.5A2.25 2.25 0 0115.75 18h-11.5A2.25 2.25 0 012 15.75v-9.5A2.25 2.25 0 014.25 4h.25V2.75A.75.75 0 015.75 2zM3.5 8.5v7.25c0 .414.336.75.75.75h11.5a.75.75 0 00.75-.75V8.5h-13z" clipRule="evenodd" />
            </svg>
            <span>{formatarDataISO(selectedDate)}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}
      {msg ? <AdminToast tone="success">{msg}</AdminToast> : null}

      {loading ? <p className="text-[var(--muted)]">Carregando agenda geral...</p> : null}
      {!loading && horarios.length === 0 ? <p className="text-[var(--muted)]">Barbearia fechada nesta data.</p> : null}
      {!loading && horarios.length > 0 ? (
        <div className="overflow-x-auto pb-2">
          <AgendaGridContent {...gridSharedProps} />
        </div>
      ) : null}

      {/* Fullscreen overlay */}
      {telaCheia && horarios.length > 0 ? (
        <div className="fixed inset-0 z-[45] flex flex-col bg-[#030705] text-white">
          {/* Compact header bar */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[rgba(4,7,6,0.98)] px-4 py-2.5">
            <div className="flex items-center gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Agenda Geral
              </p>
              <span className="text-sm font-semibold text-white">{formatarDataISO(selectedDate)}</span>
              {loading ? (
                <span className="text-[11px] text-[var(--muted)]">Atualizando...</span>
              ) : null}
              <span className="hidden text-[11px] text-[var(--muted)] landscape:hidden sm:hidden">
                Vire o celular para ver melhor ↻
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTelaCheia(false)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path d="M6.72 7.78L3.5 4.56v2.69a.75.75 0 01-1.5 0v-4.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H4.56l3.22 3.22a.75.75 0 01-1.06 1.06zM18 17.25v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 00-1.06 1.06l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75z" />
              </svg>
              Sair
            </button>
          </div>

          {/* Rotate hint – only shows in portrait on small screens */}
          <div className="pointer-events-none shrink-0 overflow-hidden" style={{ height: 0 }}>
            <style>{`
              @media (max-width: 768px) and (orientation: portrait) {
                .rotate-hint { display: flex !important; height: auto !important; }
              }
            `}</style>
          </div>
          <div className="rotate-hint hidden shrink-0 items-center justify-center gap-2 border-b border-white/10 bg-[rgba(var(--accent-rgb),0.06)] px-4 py-2 text-xs text-[var(--accent-strong)]">
            <span>↻</span>
            <span>Vire o celular na horizontal para ver a agenda completa</span>
          </div>

          {/* Scrollable grid area */}
          <div className="flex-1 overflow-auto">
            <AgendaGridContent {...gridSharedProps} compact />
          </div>
        </div>
      ) : null}

      {quickAddSlot ? (
        <QuickAddModal
          data={selectedDate}
          horaInicio={quickAddSlot.hora}
          barbeiroId={quickAddSlot.barbeiroId}
          barbeiroNome={quickAddSlot.barbeiroNome}
          onClose={() => setQuickAddSlot(null)}
          onSuccess={() => {
            setQuickAddSlot(null);
            void carregarAgenda();
          }}
        />
      ) : null}

      {selectedItem ? (
        <AgendaGeralModal
          item={selectedItem}
          barbeiroNome={barbersById.get(selectedItem.barbeiro_id)?.nome ?? "Barbeiro"}
          agora={agora}
          onClose={() => setSelectedItemId(null)}
          onConcluir={solicitarConclusao}
          onMarcarFalta={solicitarFalta}
          onMarcarPago={(item) => void atualizarAgendamento(item.id, { status_pagamento: "pago" })}
          onCancelar={solicitarCancelamento}
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

// ─── AgendaGridContent ─────────────────────────────────────────────────────

type GridBlock = {
  item: AgendaItem;
  barberIndex: number;
  rowStart: number;
  rowSpan: number;
};

function AgendaGridContent({
  barbeiros,
  horarios,
  highlightedGridCells,
  gridBlocks,
  agora,
  selectedDate,
  today,
  compact = false,
  onSelectItem,
  onQuickAdd,
}: {
  barbeiros: BarbeiroColumn[];
  horarios: string[];
  highlightedGridCells: Set<string>;
  gridBlocks: GridBlock[];
  agora: Date;
  selectedDate: string;
  today: string;
  compact?: boolean;
  onSelectItem: (id: string) => void;
  onQuickAdd: (hora: string, barbeiroId: string) => void;
}) {
  const timeColW = compact ? 64 : 78;
  const barberColMin = compact ? 155 : 220;
  const headerRowH = compact ? 44 : 56;
  const normalRowH = compact ? 54 : 64;
  const extraRowH = compact ? 40 : 48;
  const isCurrentSelectedDay = selectedDate === today;

  return (
    <div
      className={`grid gap-0 overflow-hidden border border-white/10 bg-[rgba(4,7,6,0.85)] ${
        compact ? "rounded-none" : "rounded-[28px]"
      }`}
      style={{
        gridTemplateColumns: `${timeColW}px repeat(${barbeiros.length}, minmax(${barberColMin}px, 1fr))`,
        gridTemplateRows: `${headerRowH}px ${horarios
          .map((hora) => (isExtraAgendaTimelineSlot(hora) ? `${extraRowH}px` : `${normalRowH}px`))
          .join(" ")}`,
        // Largura minima acompanha o numero de barbeiros: com poucos, o grid
        // cabe na tela e o botao "Agendar" fica visivel sem rolagem lateral.
        minWidth: `${timeColW + barberColMin * barbeiros.length}px`,
      }}
    >
      {/* Sticky corner */}
      <div className="sticky left-0 top-0 z-30 border-b border-white/10 bg-[rgba(4,7,6,0.98)]" />

      {/* Barber header columns */}
      {barbeiros.map((barbeiro, index) => (
        <div
          key={barbeiro.id}
          style={{ gridColumn: index + 2, gridRow: 1 }}
          className="border-b border-l border-white/10 bg-[rgba(4,7,6,0.98)] px-3 py-3"
        >
          <p className={`truncate uppercase tracking-[0.18em] text-[var(--accent-strong)] ${compact ? "text-[9px]" : "text-xs"}`}>
            Barbeiro
          </p>
          <p className={`mt-1 truncate font-semibold text-white ${compact ? "text-xs" : "text-sm"}`}>
            {barbeiro.nome}
          </p>
        </div>
      ))}

      {/* Time rows + background cells */}
      {horarios.map((hora, rowIndex) => (
        <Fragment key={hora}>
          <div
            style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
            className={`sticky left-0 z-20 border-b border-white/10 bg-[rgba(4,7,6,0.98)] px-3 font-semibold text-[var(--accent-strong)] ${
              isExtraAgendaTimelineSlot(hora) ? "py-2" : "py-3"
            } ${compact ? "text-[10px]" : "text-sm"}`}
          >
            {hora}
          </div>
          {barbeiros.map((barbeiro, columnIndex) => {
            const isCovered = highlightedGridCells.has(`${columnIndex}-${rowIndex}`);
            const baseTone = rowIndex % 2 === 0 ? "bg-black/45" : "bg-white/[0.055]";
            const isPast = isCurrentSelectedDay && timeToMinutes(hora) < agora.getHours() * 60 + agora.getMinutes();
            if (isCovered) {
              return (
                <div
                  key={`${hora}-${barbeiro.id}`}
                  style={{ gridColumn: columnIndex + 2, gridRow: rowIndex + 2 }}
                  className="border-b border-l border-white/10 bg-black/45"
                />
              );
            }
            return (
              <div
                key={`${hora}-${barbeiro.id}`}
                style={{ gridColumn: columnIndex + 2, gridRow: rowIndex + 2 }}
                className={`group flex items-center justify-center border-b border-l border-white/10 transition ${baseTone}`}
                title={isPast ? undefined : `Cadastrar horário às ${hora} para ${barbeiro.nome}`}
              >
                {isPast ? null : (
                  <button
                    type="button"
                    onClick={() => onQuickAdd(hora, barbeiro.id)}
                    className={`rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/10 hover:text-[var(--accent-strong)]`}
                  >
                    Agendar
                  </button>
                )}
              </div>
            );
          })}
        </Fragment>
      ))}

      {/* Appointment blocks */}
      {gridBlocks.map(({ item, barberIndex, rowStart, rowSpan }) => {
        const meta = buildStatusMeta(item, agora);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectItem(item.id)}
            style={{
              gridColumn: barberIndex + 2,
              gridRow: `${rowStart} / span ${rowSpan}`,
            }}
            className={`z-20 overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(7,10,9,0.96)] text-left shadow-[0_12px_24px_rgba(0,0,0,0.22)] hover:border-[var(--accent)]/40 hover:bg-[rgba(11,16,14,0.98)] ${
              compact ? "mx-1 my-0.5 px-2 py-1.5" : "mx-2 my-1 px-3 py-3"
            }`}
          >
            <div className="flex h-full flex-col justify-between gap-1.5">
              <div className="min-w-0">
                <p className={`line-clamp-2 font-semibold text-white ${compact ? "text-[11px] leading-4" : "text-sm"}`}>
                  {item.servico_nome}
                </p>
                <p className={`mt-0.5 truncate text-[var(--muted)] ${compact ? "text-[10px]" : "text-xs"}`}>
                  {item.nome_cliente}
                </p>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <span className={`font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)] ${compact ? "text-[10px]" : "text-[11px]"}`}>
                  {formatarHora(item.hora_inicio)}
                </span>
                <span className={`truncate rounded-full border border-white/10 bg-white/[0.04] uppercase tracking-[0.1em] text-[var(--muted)] ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}`}>
                  {meta.statusLabel}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── AgendaGeralModal ──────────────────────────────────────────────────────

function AgendaGeralModal({
  item,
  barbeiroNome,
  agora,
  onClose,
  onConcluir,
  onMarcarFalta,
  onMarcarPago,
  onCancelar,
}: {
  item: AgendaItem;
  barbeiroNome: string;
  agora: Date;
  onClose: () => void;
  onConcluir: (item: AgendaItem) => void;
  onMarcarFalta: (item: AgendaItem) => void;
  onMarcarPago: (item: AgendaItem) => void;
  onCancelar: (item: AgendaItem) => void;
}) {
  const meta = buildStatusMeta(item, agora);
  const whatsappLink = getWhatsAppLink(item.celular_cliente, `Olá ${item.nome_cliente}, sobre seu horário na ${barbershop.nome}.`);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[rgba(4,7,6,0.98)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">{barbeiroNome}</p>
            <h2 className="mt-2 break-words text-2xl font-semibold text-white">{item.servico_nome}</h2>
            <p className="mt-1 break-words text-sm text-[var(--muted)]">{item.nome_cliente}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] hover:bg-white/[0.08]"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
          <p>Horário: <span className="text-white">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</span></p>
          <p>Status: <span className="text-white">{meta.statusLabel}</span></p>
          {meta.pagamentoLabel ? <p>Pagamento: <span className="text-white">{meta.pagamentoLabel}</span></p> : null}
          <p>Data: <span className="text-white">{formatarDataISO(item.data)}</span></p>
        </div>

        {!meta.isCustom ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {meta.podeGerenciarAtendimento ? (
              <AdminActionButton onClick={() => onConcluir(item)}>
                Concluir
              </AdminActionButton>
            ) : null}
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
              >
                WhatsApp
              </a>
            ) : null}
            {meta.podeMarcarPago ? (
              <AdminActionButton tone="secondary" onClick={() => onMarcarPago(item)}>
                Marcar como pago
              </AdminActionButton>
            ) : null}
            {meta.podeGerenciarAtendimento ? (
              <AdminActionButton tone="secondary" onClick={() => onMarcarFalta(item)}>
                Marcar falta
              </AdminActionButton>
            ) : null}
            {item.status_agendamento !== "cancelado" ? (
              <AdminActionButton
                tone="danger"
                disabled={!meta.podeCancelar}
                className="disabled:border-white/10 disabled:text-[var(--muted)] disabled:hover:bg-transparent disabled:saturate-0"
                onClick={() => onCancelar(item)}
              >
                Cancelar
              </AdminActionButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
