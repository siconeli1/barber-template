"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminToast,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";

type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  ultima_visita: string | null;
  plano_ativo: string | null;
  plano_nome?: string | null;
  vencimento: string | null;
  whatsapp_link: string;
};

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useAutoDismissState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const res = await fetch("/api/admin/clientes", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro || "Erro ao carregar clientes.");
        setLoading(false);
        return;
      }
      setClientes(json.clientes ?? []);
      setLoading(false);
    }

    void carregar();
  }, [setErro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(termo) || cliente.telefone.includes(termo)
    );
  }, [busca, clientes]);

  return (
    <>
      <AdminPageHeading
        eyebrow="Clientes"
        title="Clientes"
        actions={
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome ou celular"
            className="w-full min-w-0 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm"
          />
        }
      />

      {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}

      <AdminPanel title="Lista">
        {loading ? <p className="text-[var(--muted)]">Carregando clientes...</p> : null}
        {!loading && filtrados.length === 0 ? <p className="text-[var(--muted)]">Nenhum cliente encontrado.</p> : null}

        {!loading && filtrados.length > 0 ? (
          <div className="space-y-4">
            {filtrados.map((cliente) => (
              <div key={cliente.id} className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-5 xl:grid-cols-[1.1fr_0.9fr_auto] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{cliente.nome}</h2>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {cliente.plano_nome ?? "Sem plano"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{cliente.telefone}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={cliente.whatsapp_link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                  >
                    WhatsApp
                  </a>
                  <Link
                    href={`/admin/clientes/${cliente.id}`}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
                  >
                    Ver perfil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </AdminPanel>
    </>
  );
}
