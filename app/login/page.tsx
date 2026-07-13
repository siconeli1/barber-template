"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NoticeToast } from "@/app/_components/NoticeToast";
import { useCustomerSession } from "@/lib/use-customer-session";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import { formatarCelular } from "@/lib/format";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-white">
          Carregando...
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, signIn, signOut } = useCustomerSession();

  const nextPath = searchParams.get("next") || "/minha-conta";
  const allowCreate = nextPath === "/agendar";

  const [telefoneInput, setTelefoneInput] = useState("");
  const [nomeInput, setNomeInput] = useState("");
  const [precisaNome, setPrecisaNome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useAutoDismissState();

  async function handleEntrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    setPrecisaNome(false);

    const { error } = await signIn(telefoneInput, nomeInput || undefined);

    if (error) {
      if (error.message.includes("nome") || error.message.includes("cadastro")) {
        if (!allowCreate) {
          setErro("Nenhum cadastro foi encontrado para esse numero. Faca seu primeiro agendamento para criar seu cadastro.");
          setLoading(false);
          return;
        }

        setPrecisaNome(true);
        if (!nomeInput) {
          setErro("Este numero ainda nao esta cadastrado. Informe seu nome para criar o cadastro.");
          setLoading(false);
          return;
        }
      }

      setErro(error.message);
      setLoading(false);
      return;
    }

    router.replace(nextPath);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-5xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 text-center">
          <Link href="/" className="text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Conta do cliente</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Entre com seu celular</h1>
        </div>

        {erro ? <NoticeToast tone="danger">{erro}</NoticeToast> : null}

        {!profile ? (
          <section className="mx-auto w-full max-w-2xl">
            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.16))] p-8 sm:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Acesso</p>
              <h2 className="mt-4 text-3xl font-semibold">Entrar</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {allowCreate
                  ? "Informe seu celular. Se ja agendou antes, seu cadastro sera carregado automaticamente."
                  : "Informe o celular usado anteriormente para acessar sua conta e suas reservas."}
              </p>

              <form onSubmit={handleEntrar} className="mt-8 grid gap-4">
                <input
                  type="tel"
                  value={telefoneInput}
                  onChange={(e) => setTelefoneInput(formatarCelular(e.target.value))}
                  placeholder="(17) 99999-9999"
                  maxLength={15}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/30"
                />
                {(precisaNome || nomeInput) && allowCreate ? (
                  <input
                    type="text"
                    value={nomeInput}
                    onChange={(e) => setNomeInput(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/30"
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={loading || !telefoneInput}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
                >
                  {loading ? "Verificando..." : allowCreate ? "Continuar" : "Acessar"}
                </button>
              </form>
            </div>
          </section>
        ) : (
          <section className="mx-auto w-full max-w-2xl rounded-[32px] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Conta identificada</p>
                <h2 className="mt-3 text-3xl font-semibold">Tudo pronto.</h2>
                <p className="mt-3 text-[var(--muted)]">
                  Voce entrou como <span className="font-medium text-white">{profile.nome}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-full border border-white/20 px-5 py-3 font-semibold hover:bg-white/10"
              >
                Sair
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Nome</p>
                <p className="mt-2 font-semibold">{profile.nome}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Celular</p>
                <p className="mt-2 font-semibold">{profile.telefone}</p>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href={nextPath}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
              >
                {nextPath === "/minha-conta" ? "Minha conta" : "Continuar"}
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
