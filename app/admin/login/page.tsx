"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminToast } from "@/app/admin/_components/AdminUi";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";

const PILARES = [
  "Agenda organizada em uma tela",
  "Bloqueios e marcações manuais sem atrito",
  "Clientes, financeiro e planos no mesmo painel",
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useAutoDismissState();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErro("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao fazer login.");
        return;
      }

      const nextPath = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
      router.push(nextPath || "/admin");
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-12">
        <section className="order-2 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] p-8 lg:order-1 lg:p-12">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent-strong)]">Império Ferreira</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Painel administrativo da barbearia.</h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            Cada barbeiro entra com a própria conta para acompanhar agenda, bloqueios, marcações manuais, clientes, financeiro e planos.
          </p>

          <div className="mt-8 grid gap-3">
            {PILARES.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-[var(--muted)]">
            Use apenas sua credencial individual. Se houver problema de acesso, ajuste o usuário no cadastro do barbeiro em vez de compartilhar senhas.
          </div>
        </section>

        <section className="order-1 rounded-[32px] border border-white/10 bg-black/25 p-8 lg:order-2 lg:p-10">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Entrar</p>
          <h2 className="mt-4 text-3xl font-semibold">Acesse sua rotina</h2>
          <p className="mt-3 text-[var(--muted)]">O objetivo aqui é entrar rápido e seguir trabalhando.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <input
              type="text"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Login"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
              required
            />

            {erro ? <AdminToast tone="danger">{erro}</AdminToast> : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar no painel"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}



