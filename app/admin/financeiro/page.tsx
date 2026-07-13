"use client";

import { useEffect, useState } from "react";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminMetric,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
  AdminToast,
} from "@/app/admin/_components/AdminUi";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";

type FinanceResponse = {
  escopo: "meu" | "geral";
  periodo: "dia" | "semana" | "mes";
  faixa: { inicio: string; fim: string; label: string };
  resumo: {
    receita_gerada: number;
    receita_esperada: number;
    receita_planos: number;
    receita_gerada_com_planos: number;
    receita_esperada_com_planos: number;
    concluidos: number;
    pendentes: number;
    faltas: number;
  };
  por_barbeiro: Array<{
    barbeiro_id: string;
    barbeiro_nome: string;
    receita_gerada: number;
    receita_esperada: number;
    concluidos: number;
    pendentes: number;
    faltas: number;
  }>;
  agendamentos: Array<{
    id: string;
    data: string;
    nome_cliente: string;
    servico_nome: string;
    valor_final: number;
    status_agendamento: string;
    status_atendimento: string;
    status_pagamento: string;
    tipo_cobranca: string;
  }>;
};

type AdminMeResponse = {
  barbeiro?: {
    cargo?: "socio" | "barbeiro";
  } | null;
};

export default function AdminFinanceiroPage() {
  const today = getTodayInputValue();
  const [data, setData] = useState(today);
  const [mes, setMes] = useState(today.slice(0, 7));
  const [escopo, setEscopo] = useState<"meu" | "geral">("meu");
  const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [snapshot, setSnapshot] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useAutoDismissState();
  const [canViewGeral, setCanViewGeral] = useState(false);

  useEffect(() => {
    async function carregarPermissao() {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        const json = (await res.json()) as AdminMeResponse;
        if (!res.ok) {
          return;
        }

        const socio = json.barbeiro?.cargo === "socio";
        setCanViewGeral(socio);
        if (!socio) {
          setEscopo("meu");
        }
      } catch {
        setCanViewGeral(false);
        setEscopo("meu");
      }
    }

    void carregarPermissao();
  }, [setErro]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        const params = new URLSearchParams({
          data: periodo === "mes" ? `${mes}-01` : data,
          escopo,
          periodo,
        });

        const res = await fetch(`/api/admin/financeiro?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.erro || "Erro ao carregar financeiro.");
        }

        setSnapshot(json);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar financeiro.");
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [data, escopo, mes, periodo, setErro]);

  const resumo = snapshot?.resumo;
  const receitaPrincipal = resumo?.receita_gerada ?? 0;
  const receitaPlanos = resumo?.receita_planos ?? 0;

  return (
    <>
      <AdminPageHeading eyebrow="Financeiro" title="Financeiro" />

      <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <AdminActionButton type="button" tone={escopo === "meu" ? "primary" : "secondary"} onClick={() => setEscopo("meu")}>
            Meu financeiro
          </AdminActionButton>
          {canViewGeral ? (
            <AdminActionButton type="button" tone={escopo === "geral" ? "primary" : "secondary"} onClick={() => setEscopo("geral")}>
              Visão geral
            </AdminActionButton>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminActionButton type="button" tone={periodo === "dia" ? "primary" : "secondary"} onClick={() => setPeriodo("dia")}>
            Dia
          </AdminActionButton>
          <AdminActionButton type="button" tone={periodo === "semana" ? "primary" : "secondary"} onClick={() => setPeriodo("semana")}>
            Semana
          </AdminActionButton>
          <AdminActionButton type="button" tone={periodo === "mes" ? "primary" : "secondary"} onClick={() => setPeriodo("mes")}>
            Mês
          </AdminActionButton>
        </div>

        <div className="w-full max-w-xs">
          <label className="text-sm text-[var(--muted)]">
            {periodo === "mes" ? "Mês de referência" : periodo === "dia" ? "Data de referência" : "Início do período"}
          </label>
          {periodo === "mes" ? (
            <input
              type="month"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
            />
          ) : (
            <input
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
            />
          )}
          {snapshot ? <p className="mt-3 text-sm text-[var(--muted)]">{snapshot.faixa.label}</p> : null}
        </div>
      </div>

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}
      {loading ? <p className="mb-6 text-[var(--muted)]">Carregando financeiro...</p> : null}

      {!loading && snapshot ? (
        <>
          <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${escopo === "geral" ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
            <AdminMetric
              label="Receita gerada"
              value={receitaPrincipal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              note={snapshot.faixa.label}
            />
            <AdminMetric label="Concluídos" value={String(resumo?.concluidos ?? 0)} />
            <AdminMetric label="Pendentes" value={String(resumo?.pendentes ?? 0)} />
            <AdminMetric label="Faltas e cancelamentos" value={String(resumo?.faltas ?? 0)} />
            {escopo === "geral" ? (
              <AdminMetric
                label="Planos no periodo"
                value={receitaPlanos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              />
            ) : null}
          </div>

          {escopo === "geral" && receitaPlanos > 0 ? (
            <div className="mb-6">
              <AdminNotice>
                A receita gerada considera apenas atendimentos concluídos. Os planos aparecem separados nesta visão.
              </AdminNotice>
            </div>
          ) : null}

          <div className="grid gap-6">
            <AdminPanel title="Resumo por barbeiro">
              <div className="space-y-4">
                {snapshot.por_barbeiro.map((item) => (
                  <div key={item.barbeiro_id} className="grid gap-3 rounded-[24px] border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                    <div>
                      <p className="font-semibold">{item.barbeiro_nome}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        <span className="text-emerald-300">Concluídos: {item.concluidos}</span>
                        {" - "}
                        <span>Pendentes: {item.pendentes}</span>
                        {" - "}
                        <span className="text-red-300">Faltas e cancelamentos: {item.faltas}</span>
                      </p>
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      Gerada
                      <p className="mt-1 text-base font-semibold text-white">
                        {item.receita_gerada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {item.pendentes > 0 ? "Com agenda ativa" : "Sem pendência"}
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>
          </div>
        </>
      ) : null}
    </>
  );
}
