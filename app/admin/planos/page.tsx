"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatarDataISO, getDefaultMonthlyCycle, getNextMonthlyCycleEnd } from "@/lib/format";
import type { Plano } from "@/lib/planos";
import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminMetric,
  AdminPageHeading,
  AdminPanel,
  AdminToast,
} from "@/app/admin/_components/AdminUi";

type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  plano_ativo: string | null;
};

type Assinante = {
  id: string;
  cliente_id: string;
  plano_id: string;
  plano_nome: string;
  proxima_renovacao: string;
  tipo_renovacao: string;
  clientes?: { id?: string; nome?: string; telefone?: string } | null;
};

type Notificacao = {
  id: string;
  plano_id: string;
  proxima_renovacao: string;
  clientes?: { nome?: string; telefone?: string } | null;
};

const INITIAL_CYCLE = getDefaultMonthlyCycle();
const SELECT_STYLE = { colorScheme: "dark" as const, backgroundColor: "#18211f", color: "#ffffff" };
const SELECT_OPTION_STYLE = { backgroundColor: "#101715", color: "#ffffff" };

type AdminConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "secondary" | "danger";
  onConfirm: () => Promise<void> | void;
};

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [busca, setBusca] = useState("");
  const [planoIdFiltro, setPlanoIdFiltro] = useState("");
  const [vencimento, setVencimento] = useState("todos");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [planoIdCadastro, setPlanoIdCadastro] = useState("");
  const [inicioCiclo, setInicioCiclo] = useState(INITIAL_CYCLE.inicioCiclo);
  const [fimCiclo, setFimCiclo] = useState(INITIAL_CYCLE.fimCiclo);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmState, setConfirmState] = useState<AdminConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (planoIdFiltro) params.set("plano_id", planoIdFiltro);
      if (vencimento !== "todos") params.set("vencimento", vencimento);

      const [planosRes, clientesRes, assinaturasRes] = await Promise.all([
        fetch("/api/planos", { cache: "no-store" }),
        fetch("/api/admin/clientes", { cache: "no-store" }),
        fetch(`/api/admin/assinaturas?${params.toString()}`, { cache: "no-store" }),
      ]);
      const [planosJson, clientesJson, assinaturasJson] = await Promise.all([planosRes.json(), clientesRes.json(), assinaturasRes.json()]);

      if (!planosRes.ok) throw new Error(planosJson.erro || "Erro ao carregar planos.");
      if (!clientesRes.ok) throw new Error(clientesJson.erro || "Erro ao carregar clientes.");
      if (!assinaturasRes.ok) throw new Error(assinaturasJson.erro || "Erro ao carregar assinaturas.");

      const planosCarregados = (planosJson.planos ?? []) as Plano[];
      const clientesCarregados = (clientesJson.clientes ?? []) as ClienteResumo[];

      setPlanos(planosCarregados);
      setClientes(clientesCarregados);
      setAssinantes(assinaturasJson.assinantes ?? []);
      setNotificacoes(assinaturasJson.notificacoes_vencimento ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar area de planos.");
    } finally {
      setLoading(false);
    }
  }, [busca, planoIdFiltro, vencimento]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const clientesSemPlano = useMemo(() => clientes.filter((cliente) => !cliente.plano_ativo), [clientes]);
  const clientesFiltrados = useMemo(() => {
    const termo = clienteBusca.trim().toLowerCase();
    const base = clientesSemPlano;
    if (!termo) {
      return base.slice(0, 12);
    }
    return base
      .filter((cliente) => {
        const nome = cliente.nome.toLowerCase();
        return nome.includes(termo) || cliente.telefone.includes(termo);
      })
      .slice(0, 12);
  }, [clienteBusca, clientesSemPlano]);

  useEffect(() => {
    if (!planoIdCadastro && planos[0]) {
      setPlanoIdCadastro(planos[0].id);
    }
  }, [planos, planoIdCadastro]);

  useEffect(() => {
    if (!clienteId && clientesSemPlano[0]) {
      setClienteId(clientesSemPlano[0].id);
    }
  }, [clienteId, clientesSemPlano]);

  useEffect(() => {
    if (clientesFiltrados.length === 0) {
      if (clienteId) {
        setClienteId("");
      }
      return;
    }

    if (!clientesFiltrados.some((cliente) => cliente.id === clienteId)) {
      setClienteId(clientesFiltrados[0].id);
    }
  }, [clienteId, clientesFiltrados]);

  useEffect(() => {
    if (!erro && !msg) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErro("");
      setMsg("");
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [erro, msg]);

  async function adicionarPlano(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setMsg("");
    setSalvando(true);

    try {
      const res = await fetch("/api/admin/assinaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "adicionar_plano",
          cliente_id: clienteId,
          plano_id: planoIdCadastro,
          tipo_renovacao: "manual",
          inicio_ciclo: inicioCiclo,
          fim_ciclo: fimCiclo,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao adicionar plano.");
      }

      const novoCiclo = getDefaultMonthlyCycle();
      setInicioCiclo(novoCiclo.inicioCiclo);
      setFimCiclo(novoCiclo.fimCiclo);
      setMsg("Plano adicionado com sucesso.");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao adicionar plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarPlano(clienteIdParam: string, assinaturaId: string) {
    setErro("");
    setMsg("");

    const res = await fetch(`/api/admin/clientes/${clienteIdParam}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "cancelar_plano", assinatura_id: assinaturaId }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao cancelar plano.");
      return;
    }

    setMsg("Plano cancelado.");
    await carregar();
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

  function handleInicioCicloChange(value: string) {
    setInicioCiclo(value);
    setFimCiclo(getNextMonthlyCycleEnd(value));
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Planos"
        title="Assinaturas"
      />

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}
      {msg ? <AdminToast tone="success">{msg}</AdminToast> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminMetric label="Assinantes ativos" value={String(assinantes.length)} />
        <AdminMetric label="Alertas de vencimento" value={String(notificacoes.length)} />
        <AdminMetric label="Clientes sem plano" value={String(clientesSemPlano.length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel title="Adicionar plano">
          {loading ? <p className="text-[var(--muted)]">Carregando formulario...</p> : null}

          {!loading ? (
            <form onSubmit={adicionarPlano} className="grid gap-5">
              <div className="grid gap-4">
                <input
                  type="text"
                  value={clienteBusca}
                  onChange={(event) => setClienteBusca(event.target.value)}
                  placeholder="Buscar cliente sem plano"
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
                />

                <select
                  value={clienteId}
                  onChange={(event) => setClienteId(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white"
                  style={SELECT_STYLE}
                >
                  {clientesFiltrados.length === 0 ? <option value="" style={SELECT_OPTION_STYLE}>Nenhum cliente sem plano encontrado</option> : null}
                  {clientesFiltrados.map((cliente) => (
                    <option key={cliente.id} value={cliente.id} style={SELECT_OPTION_STYLE}>
                      {cliente.nome} - {cliente.telefone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {planos.map((plano) => (
                    <PlanoOptionCard
                      key={plano.id}
                      plano={plano}
                      selected={planoIdCadastro === plano.id}
                      onClick={() => setPlanoIdCadastro(plano.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={inicioCiclo} onChange={(event) => handleInicioCicloChange(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
                <input type="date" value={fimCiclo} onChange={(event) => setFimCiclo(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
              </div>

              <AdminActionButton type="submit" disabled={salvando || !clienteId || !planoIdCadastro}>
                {salvando ? "Adicionando..." : "Adicionar plano"}
              </AdminActionButton>
            </form>
          ) : null}
        </AdminPanel>

        <AdminPanel title="Painel de assinantes">
          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar nome ou telefone" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3" />
            <select value={planoIdFiltro} onChange={(event) => setPlanoIdFiltro(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white" style={SELECT_STYLE}>
              <option value="" style={SELECT_OPTION_STYLE}>Todos os planos</option>
              {planos.map((plano) => (
                <option key={plano.id} value={plano.id} style={SELECT_OPTION_STYLE}>
                  {plano.nome}
                </option>
              ))}
            </select>
            <select value={vencimento} onChange={(event) => setVencimento(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white" style={SELECT_STYLE}>
              <option value="todos" style={SELECT_OPTION_STYLE}>Todos os vencimentos</option>
              <option value="hoje" style={SELECT_OPTION_STYLE}>Vencendo hoje</option>
              <option value="proximos_7" style={SELECT_OPTION_STYLE}>Proximos 7 dias</option>
            </select>
          </div>

          {loading ? <p className="text-[var(--muted)]">Carregando assinantes...</p> : null}
          {!loading && assinantes.length === 0 ? <p className="text-[var(--muted)]">Nenhum assinante encontrado.</p> : null}

          {!loading && assinantes.length > 0 ? (
            <div className="space-y-4">
              {assinantes.map((item) => (
                <div key={item.id} className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold">{item.clientes?.nome ?? "Cliente"}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                        {item.plano_nome}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.clientes?.telefone ?? "-"}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Vencimento: {formatarDataISO(item.proxima_renovacao)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Renovacao: {item.tipo_renovacao}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {item.clientes?.id ? (
                      <>
                        <Link href={`/admin/clientes/${item.clientes.id}`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                          Abrir cliente
                        </Link>
                        <AdminActionButton
                          tone="danger"
                          onClick={() =>
                            setConfirmState({
                              title: "Remover plano do cliente",
                              description: "O cliente perdera a assinatura ativa imediatamente e passara a agendar como avulso.",
                              confirmLabel: "Remover plano",
                              tone: "danger",
                              onConfirm: () => cancelarPlano(item.clientes!.id!, item.id),
                            })
                          }
                        >
                          Remover plano
                        </AdminActionButton>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </AdminPanel>
      </div>

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

function PlanoOptionCard({
  plano,
  selected,
  onClick,
}: {
  plano: Plano;
  selected: boolean;
  onClick: () => void;
}) {
  const itens = [
    plano.cortes_incluidos > 0 ? `${plano.cortes_incluidos} corte(s)` : null,
    plano.barbas_incluidas > 0 ? `${plano.barbas_incluidas} barba(s)` : null,
    plano.sobrancelhas_incluidas > 0 ? `${plano.sobrancelhas_incluidas} sobrancelha(s)` : null,
  ].filter(Boolean) as string[];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        selected
          ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.22),rgba(var(--accent-rgb),0.12))] shadow-[0_14px_28px_rgba(var(--accent-rgb),0.12)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{plano.nome}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{plano.descricao || "Cobertura mensal da barbearia."}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${selected ? "bg-black/15 text-[var(--background)]" : "border border-white/10 bg-black/20 text-[var(--accent-strong)]"}`}>
          {Number(plano.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      </div>

      {itens.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {itens.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[var(--muted)]">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
