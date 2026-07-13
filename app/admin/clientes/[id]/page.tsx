"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatarDataISO, getDefaultMonthlyCycle, getNextMonthlyCycleEnd } from "@/lib/format";
import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminMetric,
  AdminPageHeading,
  AdminPanel,
  AdminToast,
} from "@/app/admin/_components/AdminUi";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";

const SELECT_STYLE = { colorScheme: "dark" as const, backgroundColor: "#18211f", color: "#ffffff" };
const SELECT_OPTION_STYLE = { backgroundColor: "#101715", color: "#ffffff" };

type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  cortes_incluidos: number;
  barbas_incluidas: number;
  sobrancelhas_incluidas: number;
};

type ClienteDetalhe = {
  cliente: {
    id: string;
    nome: string;
    telefone: string;
    whatsapp_link: string;
  };
  assinatura: {
    id: string;
    plano_id: string;
    tipo_renovacao: "manual" | "automatica";
    inicio_ciclo: string;
    fim_ciclo: string;
    proxima_renovacao: string;
    cortes_restantes: number;
    barbas_restantes: number;
    sobrancelhas_restantes: number;
    observacoes_internas?: string | null;
  } | null;
  plano: Plano | null;
  reservas_periodo: Array<Record<string, unknown>>;
  faltas_periodo: number;
  cancelamentos_periodo: number;
  financeiro: Array<Record<string, unknown>>;
  historico_telefone: Array<Record<string, unknown>>;
  historico_uso: Array<Record<string, unknown>>;
};

const INITIAL_CYCLE = getDefaultMonthlyCycle();

type AdminConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "secondary" | "danger";
  onConfirm: () => Promise<void> | void;
};

export default function ClienteDetalhePage() {
  const params = useParams<{ id: string }>();
  const clienteId = String(params?.id ?? "");
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState("");
  const [inicioCiclo, setInicioCiclo] = useState(INITIAL_CYCLE.inicioCiclo);
  const [fimCiclo, setFimCiclo] = useState(INITIAL_CYCLE.fimCiclo);
  const [observacoes, setObservacoes] = useState("");
  const [categoriaUso, setCategoriaUso] = useState<"corte" | "barba" | "sobrancelha">("corte");
  const [quantidadeUso, setQuantidadeUso] = useState(1);
  const [erro, setErro] = useAutoDismissState();
  const [msg, setMsg] = useAutoDismissState();
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<AdminConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");

    const [detalheRes, planosRes] = await Promise.all([
      fetch(`/api/admin/clientes/${clienteId}`, { cache: "no-store" }),
      fetch("/api/planos", { cache: "no-store" }),
    ]);
    const [detalheJson, planosJson] = await Promise.all([detalheRes.json(), planosRes.json()]);

    if (!detalheRes.ok) {
      setErro(detalheJson.erro || "Erro ao carregar cliente.");
      setLoading(false);
      return;
    }
    if (!planosRes.ok) {
      setErro(planosJson.erro || "Erro ao carregar planos.");
      setLoading(false);
      return;
    }

    const novoCiclo = getDefaultMonthlyCycle();

    setDetalhe(detalheJson);
    setPlanos(planosJson.planos ?? []);
    setPlanoId(detalheJson.assinatura?.plano_id ?? planosJson.planos?.[0]?.id ?? "");
    setInicioCiclo(novoCiclo.inicioCiclo);
    setFimCiclo(novoCiclo.fimCiclo);
    setObservacoes(String(detalheJson.assinatura?.observacoes_internas ?? ""));
    setLoading(false);
  }, [clienteId, setErro]);

  useEffect(() => {
    if (!clienteId) return;
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await carregar();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [carregar, clienteId]);

  async function acaoPlano(acao: "adicionar_plano" | "renovar_plano" | "troca_imediata") {
    setErro("");
    setMsg("");

    const payload: Record<string, unknown> = {
      acao,
      cliente_id: clienteId,
      plano_id: planoId,
      tipo_renovacao: "manual",
      inicio_ciclo: inicioCiclo,
      fim_ciclo: fimCiclo,
      observacoes,
    };

    if (detalhe?.assinatura?.id) {
      payload.assinatura_id = detalhe.assinatura.id;
    }

    const res = await fetch("/api/admin/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao atualizar plano.");
      return;
    }

    const novoCiclo = getDefaultMonthlyCycle();
    setInicioCiclo(novoCiclo.inicioCiclo);
    setFimCiclo(novoCiclo.fimCiclo);
    setMsg("Plano atualizado com sucesso.");
    await carregar();
  }

  async function salvarObservacoes() {
    if (!detalhe?.assinatura?.id) return;

    const res = await fetch(`/api/admin/clientes/${clienteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "atualizar_observacoes_assinatura",
        assinatura_id: detalhe.assinatura.id,
        observacoes,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao salvar observacoes.");
      return;
    }

    setMsg("Observacoes internas atualizadas.");
    await carregar();
  }

  async function cancelarPlano() {
    if (!detalhe?.assinatura?.id) return;

    const res = await fetch(`/api/admin/clientes/${clienteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "cancelar_plano", assinatura_id: detalhe.assinatura.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao cancelar plano.");
      return;
    }

    setMsg("Plano cancelado.");
    await carregar();
  }

  async function registrarUsoManual() {
    const res = await fetch("/api/admin/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "registrar_uso_manual",
        cliente_id: clienteId,
        categoria: categoriaUso,
        quantidade: quantidadeUso,
        observacao: "Uso manual registrado pelo barbeiro",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao registrar uso manual.");
      return;
    }

    setMsg("Uso manual registrado.");
    await carregar();
  }

  function handleInicioCicloChange(value: string) {
    setInicioCiclo(value);
    setFimCiclo(getNextMonthlyCycleEnd(value));
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

  return (
    <>
      <AdminPageHeading
        eyebrow="Perfil do cliente"
        title={detalhe?.cliente.nome ?? "Carregando cliente"}
        description="Veja os dados do cliente, o uso do plano, o historico financeiro e as acoes administrativas em uma unica tela."
      />

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}
      {msg ? <AdminToast tone="success">{msg}</AdminToast> : null}
      {loading ? <p className="text-[var(--muted)]">Carregando perfil...</p> : null}

      {!loading && detalhe ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-6">
            <AdminMetric label="Plano atual" value={detalhe.plano?.nome ?? "Sem plano"} />
            <AdminMetric label="Cortes" value={String(detalhe.assinatura?.cortes_restantes ?? 0)} />
            <AdminMetric label="Barbas" value={String(detalhe.assinatura?.barbas_restantes ?? 0)} />
            <AdminMetric label="Sobrancelhas" value={String(detalhe.assinatura?.sobrancelhas_restantes ?? 0)} />
            <AdminMetric label="Faltas" value={String(detalhe.faltas_periodo ?? 0)} />
            <AdminMetric label="Cancelamentos" value={String(detalhe.cancelamentos_periodo ?? 0)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <AdminPanel title="Dados do cliente" description="Estas informações valem para qualquer barbeiro da barbearia, porque o cadastro do cliente é único.">
              <div className="space-y-3 text-sm text-[var(--muted)]">
                <p><span className="text-white">Nome:</span> {detalhe.cliente.nome}</p>
                <p><span className="text-white">Celular:</span> {detalhe.cliente.telefone}</p>
              </div>
              <div className="mt-5">
                <a href={detalhe.cliente.whatsapp_link} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                  Abrir WhatsApp
                </a>
              </div>
            </AdminPanel>

            <AdminPanel title="Gestao do plano">
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {planos.map((plano) => (
                    <PlanoOptionCard
                      key={plano.id}
                      plano={plano}
                      selected={planoId === plano.id}
                      onClick={() => setPlanoId(plano.id)}
                    />
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={inicioCiclo} onChange={(event) => handleInicioCicloChange(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
                  <input type="date" value={fimCiclo} onChange={(event) => setFimCiclo(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
                </div>

                <div className="flex flex-wrap gap-3">
                  {!detalhe.assinatura ? (
                    <AdminActionButton
                      onClick={() =>
                        setConfirmState({
                          title: "Adicionar plano ao cliente",
                          description: "O plano escolhido sera ativado imediatamente para esse cliente com o ciclo informado abaixo.",
                          confirmLabel: "Adicionar plano",
                          tone: "primary",
                          onConfirm: () => acaoPlano("adicionar_plano"),
                        })
                      }
                    >
                      Adicionar plano
                    </AdminActionButton>
                  ) : null}
                  {detalhe.assinatura ? (
                    <AdminActionButton
                      onClick={() =>
                        setConfirmState({
                          title: "Renovar plano do cliente",
                          description: "Os creditos do plano serao renovados para o proximo ciclo configurado abaixo.",
                          confirmLabel: "Renovar plano",
                          tone: "primary",
                          onConfirm: () => acaoPlano("renovar_plano"),
                        })
                      }
                    >
                      Renovar plano
                    </AdminActionButton>
                  ) : null}
                  {detalhe.assinatura ? (
                    <AdminActionButton
                      tone="secondary"
                      onClick={() =>
                        setConfirmState({
                          title: "Aplicar troca imediata",
                          description: "Os novos creditos entram no ciclo atual sem reiniciar o saldo que o cliente ainda possui.",
                          confirmLabel: "Aplicar troca",
                          tone: "secondary",
                          onConfirm: () => acaoPlano("troca_imediata"),
                        })
                      }
                    >
                      Troca imediata
                    </AdminActionButton>
                  ) : null}
                  {detalhe.assinatura ? (
                    <AdminActionButton
                      tone="danger"
                      onClick={() =>
                        setConfirmState({
                          title: "Cancelar plano ativo",
                          description: "O cliente perdera a assinatura ativa imediatamente e voltara a agendar como avulso.",
                          confirmLabel: "Cancelar plano",
                          tone: "danger",
                          onConfirm: () => cancelarPlano(),
                        })
                      }
                    >
                      Cancelar plano
                    </AdminActionButton>
                  ) : null}
                </div>
              </div>
            </AdminPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <AdminPanel title="Registrar uso manual" description="Use quando o cliente foi atendido sem agendamento e o consumo precisa entrar no plano mesmo assim.">
              <div className="grid gap-4">
                <select value={categoriaUso} onChange={(event) => setCategoriaUso(event.target.value as "corte" | "barba" | "sobrancelha")} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white" style={SELECT_STYLE}>
                  <option value="corte" style={SELECT_OPTION_STYLE}>Corte</option>
                  <option value="barba" style={SELECT_OPTION_STYLE}>Barba</option>
                  <option value="sobrancelha" style={SELECT_OPTION_STYLE}>Sobrancelha</option>
                </select>
                <input type="number" min={1} value={quantidadeUso} onChange={(event) => setQuantidadeUso(Number(event.target.value) || 1)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3" />
                <AdminActionButton
                  onClick={() =>
                    setConfirmState({
                      title: "Registrar uso manual do plano",
                      description: "Essa acao consome creditos do cliente mesmo sem existir um agendamento vinculado.",
                      confirmLabel: "Registrar uso",
                      tone: "secondary",
                      onConfirm: () => registrarUsoManual(),
                    })
                  }
                >
                  Registrar uso do plano
                </AdminActionButton>
              </div>
            </AdminPanel>

            <AdminPanel title="Observacoes internas" description="Notas de contexto para o barbeiro lembrar preferencias, comportamento ou combinados.">
              <textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3" placeholder="Escreva observacoes internas sobre o cliente ou a assinatura." />
              {detalhe.assinatura ? (
                <div className="mt-4">
                  <AdminActionButton onClick={salvarObservacoes}>Salvar observacoes</AdminActionButton>
                </div>
              ) : null}
            </AdminPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-4">
            <AdminPanel title="Reservas do periodo">
              <div className="space-y-3">
                {detalhe.reservas_periodo.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {item.data ? formatarDataISO(String(item.data)) : "-"} - {String(item.servico_nome ?? "-")} - {String(item.status_agendamento ?? "agendado")}
                  </div>
                ))}
                {detalhe.reservas_periodo.length === 0 ? <p className="text-[var(--muted)]">Sem reservas no ciclo.</p> : null}
              </div>
            </AdminPanel>

            <AdminPanel title="Historico de uso">
              <div className="space-y-3">
                {detalhe.historico_uso.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.tipo_movimentacao ?? "-")} - {String(item.categoria_servico ?? "-")} - {String(item.quantidade ?? 1)}
                  </div>
                ))}
                {detalhe.historico_uso.length === 0 ? <p className="text-[var(--muted)]">Sem uso registrado.</p> : null}
              </div>
            </AdminPanel>

            <AdminPanel title="Historico financeiro">
              <div className="space-y-3">
                {detalhe.financeiro.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.descricao ?? "-")} - {Number(item.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                ))}
                {detalhe.financeiro.length === 0 ? <p className="text-[var(--muted)]">Sem lancamentos.</p> : null}
              </div>
            </AdminPanel>

            <AdminPanel title="Historico de telefone">
              <div className="space-y-3">
                {detalhe.historico_telefone.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.telefone ?? "-")} - {String(item.origem ?? "-")}
                  </div>
                ))}
                {detalhe.historico_telefone.length === 0 ? <p className="text-[var(--muted)]">Sem alterações registradas.</p> : null}
              </div>
            </AdminPanel>
          </div>
        </div>
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
