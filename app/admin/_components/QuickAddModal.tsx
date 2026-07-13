"use client";

import { useEffect, useRef, useState } from "react";
import { AdminActionButton } from "@/app/admin/_components/AdminUi";

type Servico = {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
};

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  plano_nome?: string | null;
};

type ClienteMode = "cadastrado" | "manual";
type CobrancaMode = "plano" | "avulso";

export function QuickAddModal({
  data,
  horaInicio,
  barbeiroId,
  barbeiroNome,
  onClose,
  onSuccess,
}: {
  data: string;
  horaInicio: string;
  barbeiroId: string;
  barbeiroNome?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [servicoId, setServicoId] = useState("");
  const [clienteMode, setClienteMode] = useState<ClienteMode>("cadastrado");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [nomeManual, setNomeManual] = useState("");
  const [celularManual, setCelularManual] = useState("");
  const [cobrancaMode, setCobrancaMode] = useState<CobrancaMode>("plano");
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const buscaRef = useRef<HTMLInputElement>(null);
  const sugestoesRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const [servicosRes, clientesRes] = await Promise.all([
          fetch("/api/servicos", { cache: "no-store" }),
          fetch("/api/admin/clientes", { cache: "no-store" }),
        ]);
        const servicosJson = await servicosRes.json();
        const clientesJson = await clientesRes.json();

        const lista: Servico[] = servicosJson.servicos ?? [];
        setServicos(lista);
        if (lista.length > 0) {
          setServicoId(lista[0].id);
        }
        setClientes(clientesJson.clientes ?? []);
      } catch {
        setErro("Não foi possível carregar os dados.");
      } finally {
        setLoadingData(false);
      }
    }
    void loadData();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        buscaRef.current &&
        !buscaRef.current.contains(event.target as Node) &&
        sugestoesRef.current &&
        !sugestoesRef.current.contains(event.target as Node)
      ) {
        setShowSugestoes(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const sugestoesFiltradas = clienteBusca.trim().length >= 1
    ? clientes.filter((c) => {
        const termo = clienteBusca.toLowerCase();
        return c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo);
      }).slice(0, 8)
    : [];
  const clienteCadastradoComPlano = Boolean(clienteSelecionado?.plano_nome);
  const podeEscolherCobrancaPlano = clienteMode === "cadastrado" && clienteCadastradoComPlano;

  useEffect(() => {
    if (podeEscolherCobrancaPlano) {
      setCobrancaMode("plano");
      return;
    }
    setCobrancaMode("avulso");
  }, [podeEscolherCobrancaPlano]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro("");
    setAviso("");

    if (!servicoId) {
      setErro("Selecione um serviço.");
      return;
    }

    if (clienteMode === "cadastrado" && !clienteSelecionado) {
      setErro("Selecione um cliente cadastrado ou use a opção manual.");
      return;
    }

    if (clienteMode === "manual") {
      if (!nomeManual.trim()) {
        setErro("Informe o nome do cliente.");
        return;
      }
      if (!celularManual.trim()) {
        setErro("Informe o celular do cliente com DDD.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        data,
        hora_inicio: horaInicio,
        servico_id: servicoId,
        barbeiro_id: barbeiroId,
        preferencia_cobranca: podeEscolherCobrancaPlano ? cobrancaMode : "avulso",
      };

      if (clienteMode === "cadastrado" && clienteSelecionado) {
        body.cliente_id = clienteSelecionado.id;
      } else {
        body.nome_cliente = nomeManual.trim();
        body.celular_cliente = celularManual.trim();
      }

      if (observacoes.trim()) {
        body.observacoes = observacoes.trim();
      }

      const res = await fetch("/api/admin-agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao cadastrar horário.");
        return;
      }

      if (json.aviso) {
        setAviso(json.aviso);
      }

      onSuccess();
    } catch {
      setErro("Não foi possível cadastrar o horário agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="animate-fade-in-up flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,17,0.99),rgba(4,7,6,0.99))] shadow-[0_36px_80px_rgba(0,0,0,0.48)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Novo agendamento
            </p>
            <h2 className="mt-1.5 text-xl font-semibold text-white">
              {horaInicio}
              {barbeiroNome ? (
                <span className="ml-2 text-base font-normal text-[var(--muted)]">· {barbeiroNome}</span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{formatDate(data)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loadingData ? (
            <div className="space-y-3">
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.06]" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.06]" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.06]" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Serviço */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Serviço
                </label>
                <select
                  value={servicoId}
                  onChange={(e) => setServicoId(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white disabled:opacity-60"
                  style={{ colorScheme: "dark" }}
                >
                  {servicos.map((servico) => (
                    <option key={servico.id} value={servico.id} style={{ backgroundColor: "#111", color: "#fff" }}>
                      {servico.nome} — {servico.duracao_minutos}min
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente mode toggle */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Cliente
                </label>
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClienteMode("cadastrado");
                      setNomeManual("");
                      setCelularManual("");
                    }}
                    className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition ${
                      clienteMode === "cadastrado"
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/10 bg-white/[0.03] text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    Cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClienteMode("manual");
                      setClienteSelecionado(null);
                      setClienteBusca("");
                    }}
                    className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition ${
                      clienteMode === "manual"
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/10 bg-white/[0.03] text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    Manual
                  </button>
                </div>

                {clienteMode === "cadastrado" ? (
                  <div className="relative">
                    {clienteSelecionado ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/8 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{clienteSelecionado.nome}</p>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {clienteSelecionado.telefone}
                            {clienteSelecionado.plano_nome ? (
                              <span className="ml-2 text-[var(--accent-strong)]">· {clienteSelecionado.plano_nome}</span>
                            ) : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteSelecionado(null);
                            setClienteBusca("");
                            setTimeout(() => buscaRef.current?.focus(), 50);
                          }}
                          className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
                        >
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={buscaRef}
                          type="text"
                          value={clienteBusca}
                          onChange={(e) => {
                            setClienteBusca(e.target.value);
                            setShowSugestoes(true);
                          }}
                          onFocus={() => setShowSugestoes(true)}
                          placeholder="Buscar por nome ou celular..."
                          disabled={submitting}
                          autoComplete="off"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none disabled:opacity-60"
                        />
                        {showSugestoes && sugestoesFiltradas.length > 0 ? (
                          <ul
                            ref={sugestoesRef}
                            className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(10,14,12,0.98)] shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
                          >
                            {sugestoesFiltradas.map((cliente) => (
                              <li key={cliente.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06]"
                                  onClick={() => {
                                    setClienteSelecionado(cliente);
                                    setClienteBusca("");
                                    setShowSugestoes(false);
                                  }}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-white">{cliente.nome}</p>
                                    <p className="truncate text-xs text-[var(--muted)]">
                                      {cliente.telefone}
                                      {cliente.plano_nome ? (
                                        <span className="ml-2 text-[var(--accent-strong)]">· {cliente.plano_nome}</span>
                                      ) : null}
                                    </p>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : showSugestoes && clienteBusca.trim().length >= 1 ? (
                          <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-2xl border border-white/10 bg-[rgba(10,14,12,0.98)] px-4 py-3 text-sm text-[var(--muted)]">
                            Nenhum cliente encontrado.
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={nomeManual}
                      onChange={(e) => setNomeManual(e.target.value)}
                      placeholder="Nome do cliente"
                      disabled={submitting}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none disabled:opacity-60"
                    />
                    <input
                      type="tel"
                      value={celularManual}
                      onChange={(e) => setCelularManual(e.target.value)}
                      placeholder="Celular com DDD (ex: 41999990000)"
                      disabled={submitting}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Observações <span className="normal-case tracking-normal text-[var(--muted)]/60">(opcional)</span>
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  placeholder="Ex: cliente preferencial, trazer produto específico..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none disabled:opacity-60"
                />
              </div>

              {/* Cobranca */}
              {podeEscolherCobrancaPlano ? (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Cobrança
                  </label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="relative grid grid-cols-2 rounded-full border border-white/10 bg-black/25 p-1">
                      <span
                        className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-[var(--accent)] shadow-[0_10px_24px_rgba(var(--accent-rgb),0.28)] transition-transform duration-200 ${
                          cobrancaMode === "plano" ? "translate-x-0" : "translate-x-full"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setCobrancaMode("plano")}
                        className={`relative z-10 min-h-9 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                          cobrancaMode === "plano" ? "text-black" : "text-[var(--muted)] hover:text-white"
                        }`}
                      >
                        Crédito do plano
                      </button>
                      <button
                        type="button"
                        onClick={() => setCobrancaMode("avulso")}
                        className={`relative z-10 min-h-9 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                          cobrancaMode === "avulso" ? "text-black" : "text-[var(--muted)] hover:text-white"
                        }`}
                      >
                        Avulso
                      </button>
                    </div>
                    <p
                      className={`mt-2 text-xs ${
                        cobrancaMode === "plano" ? "text-emerald-300" : "text-amber-200"
                      }`}
                    >
                      {cobrancaMode === "plano"
                        ? "Será priorizado o uso de créditos do plano quando houver cobertura e saldo."
                        : "Lançamento forçado como serviço avulso por escolha do barbeiro."}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Error / warning */}
              {erro ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  {erro}
                </div>
              ) : null}
              {aviso ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">
                  {aviso}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <AdminActionButton
                  type="submit"
                  tone="primary"
                  disabled={submitting}
                  className="min-h-11 flex-1 justify-center"
                >
                  {submitting ? "Cadastrando..." : "Cadastrar horário"}
                </AdminActionButton>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}
