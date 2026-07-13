"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminPageHeading,
  AdminPanel,
  AdminScopeNotice,
  AdminToast,
} from "@/app/admin/_components/AdminUi";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";

type Servico = {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
};

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  plano_nome?: string | null;
};

type AgendaResumo = {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  servico_nome: string;
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

export default function AdminMarcarPage() {
  const today = getTodayInputValue();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendaData, setAgendaData] = useState<AgendaResumo[]>([]);
  const [adminCargo, setAdminCargo] = useState<"socio" | "barbeiro" | "">("");
  const [barbeiros, setBarbeiros] = useState<BarbeiroOption[]>([]);
  const [barbeiroId, setBarbeiroId] = useState("");
  const [data, setData] = useState(today);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [servicoId, setServicoId] = useState("");
  const [modoCliente, setModoCliente] = useState<"existente" | "manual">("existente");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [celularCliente, setCelularCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useAutoDismissState();
  const [msg, setMsg] = useAutoDismissState();
  const [contextLoading, setContextLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const [adminRes, servicosRes, clientesRes] = await Promise.all([
        fetch("/api/admin/me", { cache: "no-store" }),
        fetch("/api/servicos", { cache: "no-store" }),
        fetch("/api/admin/clientes", { cache: "no-store" }),
      ]);
      const [adminJson, servicosJson, clientesJson] = await Promise.all([
        adminRes.json(),
        servicosRes.json(),
        clientesRes.json(),
      ]);

      if (!adminRes.ok) {
        throw new Error(adminJson.erro || "Erro ao carregar sessão administrativa.");
      }

      if (!servicosRes.ok) {
        throw new Error(servicosJson.erro || "Erro ao carregar serviços.");
      }
      if (!clientesRes.ok) {
        throw new Error(clientesJson.erro || "Erro ao carregar clientes.");
      }

      const admin = (adminJson as AdminMeResponse).barbeiro;
      setAdminCargo(admin.cargo);

      if (admin.cargo === "socio") {
        const barbeirosRes = await fetch("/api/barbeiros", { cache: "no-store" });
        const barbeirosJson = await barbeirosRes.json();

        if (!barbeirosRes.ok) {
          throw new Error(barbeirosJson.erro || "Erro ao carregar barbeiros.");
        }

        const options = (barbeirosJson.barbeiros ?? []) as BarbeiroOption[];
        setBarbeiros(options);
        setBarbeiroId((current) => current || admin.id);
      } else {
        setBarbeiros([{ id: admin.id, nome: admin.nome }]);
        setBarbeiroId(admin.id);
      }

      const servicosAtivos = servicosJson.servicos ?? [];
      setServicos(servicosAtivos);
      setClientes(clientesJson.clientes ?? []);

      if (servicosAtivos[0] && !servicoId) {
        setServicoId(servicosAtivos[0].id);
      }
      if ((clientesJson.clientes ?? [])[0] && !clienteId) {
        setClienteId(clientesJson.clientes[0].id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar dados.");
    } finally {
      setContextLoading(false);
      setLoading(false);
    }
  }, [clienteId, servicoId, setErro]);

  const carregarAgendaDia = useCallback(async () => {
    if (contextLoading) {
      return;
    }

    if (!barbeiroId) {
      setAgendaData([]);
      return;
    }

    try {
      const search = new URLSearchParams({ data, barbeiro_id: barbeiroId });
      const res = await fetch(`/api/admin-agenda?${search.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar agenda do dia.");
      }

      setAgendaData(json ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda do dia.");
    }
  }, [barbeiroId, contextLoading, data, setErro]);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  useEffect(() => {
    void carregarAgendaDia();
  }, [carregarAgendaDia]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) {
      return clientes.slice(0, 10);
    }

    return clientes
      .filter((cliente) => {
        const nome = cliente.nome.toLowerCase();
        return nome.includes(termo) || cliente.telefone.includes(termo);
      })
      .slice(0, 10);
  }, [buscaCliente, clientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteId) ?? null,
    [clienteId, clientes]
  );
  const barbeiroSelecionado = useMemo(
    () => barbeiros.find((barbeiro) => barbeiro.id === barbeiroId) ?? null,
    [barbeiroId, barbeiros]
  );
  const fieldClass =
    "w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white";

  async function marcarHorario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setMsg("");
    setSalvando(true);

    try {
      const res = await fetch("/api/admin-agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          barbeiro_id: barbeiroId,
          hora_inicio: horaInicio,
          servico_id: servicoId,
          cliente_id: modoCliente === "existente" ? clienteId : null,
          nome_cliente: modoCliente === "manual" ? nomeCliente : null,
          celular_cliente: modoCliente === "manual" ? celularCliente : null,
          observacoes,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao marcar horário.");
      }

      setMsg(json.aviso || "Horário marcado com sucesso.");
      setObservacoes("");
      if (modoCliente === "manual") {
        setNomeCliente("");
        setCelularCliente("");
      }
      await carregarAgendaDia();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao marcar horário.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Marcar horários"
        title="Marcar horário"
      />

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}
      {msg ? <AdminToast tone="success">{msg}</AdminToast> : null}
      {adminCargo === "socio" && barbeiroSelecionado ? (
        <div className="mb-6">
          <AdminScopeNotice title={`Novo horário para ${barbeiroSelecionado.nome}.`} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <AdminPanel title="Novo horário" >
          {loading ? <p className="text-[var(--muted)]">Carregando base do formulario...</p> : null}

          {!loading ? (
            <form onSubmit={marcarHorario} className="grid min-w-0 gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={data} onChange={(event) => setData(event.target.value)} className={`datetime-input ${fieldClass}`} />
                <input type="time" value={horaInicio} onChange={(event) => setHoraInicio(event.target.value)} className={`datetime-input ${fieldClass}`} />
              </div>

              {adminCargo === "socio" ? (
                <select value={barbeiroId} onChange={(event) => setBarbeiroId(event.target.value)} className={fieldClass}>
                  {barbeiros.map((barbeiro) => (
                    <option key={barbeiro.id} value={barbeiro.id}>
                      {barbeiro.nome}
                    </option>
                  ))}
                </select>
              ) : null}

              <select value={servicoId} onChange={(event) => setServicoId(event.target.value)} className={fieldClass}>
                {servicos.map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome} - {servico.duracao_minutos} min - {Number(servico.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </option>
                ))}
              </select>

              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <AdminActionButton type="button" tone={modoCliente === "existente" ? "primary" : "secondary"} onClick={() => setModoCliente("existente")} className="w-full justify-center sm:w-auto">
                  Cliente cadastrado
                </AdminActionButton>
                <AdminActionButton type="button" tone={modoCliente === "manual" ? "primary" : "secondary"} onClick={() => setModoCliente("manual")} className="w-full justify-center sm:w-auto">
                  Preencher manualmente
                </AdminActionButton>
              </div>

              {modoCliente === "existente" ? (
                <div className="grid min-w-0 gap-3">
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(event) => setBuscaCliente(event.target.value)}
                    placeholder="Buscar cliente por nome ou celular"
                    className={fieldClass}
                  />
                  <select value={clienteId} onChange={(event) => setClienteId(event.target.value)} className={fieldClass}>
                    {clientesFiltrados.length === 0 ? <option value="">Nenhum cliente encontrado</option> : null}
                    {clientesFiltrados.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome} - {cliente.telefone}
                      </option>
                    ))}
                  </select>

                  {clienteSelecionado ? (
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[var(--muted)]">
                      <p className="break-words text-white">{clienteSelecionado.nome}</p>
                      <p className="mt-1 break-all">{clienteSelecionado.telefone}</p>
                      <p className="mt-2 text-[var(--accent-strong)]">{clienteSelecionado.plano_nome || "Sem plano ativo"}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3">
                  <input
                    type="text"
                    value={nomeCliente}
                    onChange={(event) => setNomeCliente(event.target.value)}
                    placeholder="Nome do cliente"
                    className={fieldClass}
                  />
                  <input
                    type="text"
                    value={celularCliente}
                    onChange={(event) => setCelularCliente(event.target.value)}
                    placeholder="Celular do cliente"
                    className={fieldClass}
                  />
                </div>
              )}

              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Observacoes internas (opcional)"
                className={`${fieldClass} min-h-[110px] resize-y`}
              />

              <AdminActionButton
                type="submit"
                disabled={salvando || !barbeiroId || !servicoId || (modoCliente === "existente" ? !clienteId : !nomeCliente || !celularCliente)}
                className="w-full justify-center"
              >
                {salvando ? "Salvando..." : "Marcar horário"}
              </AdminActionButton>
            </form>
          ) : null}
        </AdminPanel>

        <AdminPanel title="Agenda da data">
          <div className="mb-5 max-w-xs">
            <label className="text-sm text-[var(--muted)]">Data consultada</label>
            <input
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className={`datetime-input mt-3 ${fieldClass}`}
            />
          </div>

          {contextLoading ? <p className="text-[var(--muted)]">Carregando agenda...</p> : null}

          {!contextLoading && agendaData.length === 0 ? <p className="text-[var(--muted)]">Nenhum horário ativo nessa data.</p> : null}

          {!contextLoading && agendaData.length > 0 ? (
            <div className="space-y-4">
              {agendaData.map((item) => (
                <div key={item.id} className="min-w-0 rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}</p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {item.origem === "horario_customizado" ? "Reserva manual" : "Agendamento"}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm text-[var(--muted)]">{item.nome_cliente}</p>
                  <p className="mt-1 break-words text-sm text-[var(--muted)]">{item.servico_nome}</p>
                </div>
              ))}
            </div>
          ) : null}
        </AdminPanel>
      </div>
    </>
  );
}
