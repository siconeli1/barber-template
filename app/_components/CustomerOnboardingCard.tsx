"use client";

import { useState } from "react";
import { formatarCelular } from "@/lib/format";
import { NoticeToast } from "@/app/_components/NoticeToast";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import { useCustomerSession } from "@/lib/use-customer-session";

type CustomerOnboardingCardProps = {
  title?: string;
  description?: string;
  submitLabel?: string;
  onSaved?: () => Promise<void> | void;
};

export function CustomerOnboardingCard({
  title = "Atualize seu cadastro",
  description = "Informe seu nome e celular para continuar.",
  submitLabel = "Salvar",
  onSaved,
}: CustomerOnboardingCardProps) {
  const { profile, signIn } = useCustomerSession();
  const [nome, setNome] = useState(profile?.nome ?? "");
  const [telefone, setTelefone] = useState(profile?.telefone ?? "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useAutoDismissState();

  async function salvar() {
    if (!nome.trim() || !telefone.trim()) {
      setErro("Preencha nome e celular para continuar.");
      return;
    }

    setLoading(true);
    setErro("");

    const { error } = await signIn(telefone, nome.trim());

    if (error) {
      setErro(error.message || "Erro ao salvar cadastro.");
      setLoading(false);
      return;
    }

    setLoading(false);
    await onSaved?.();
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">{description}</p>

      {erro ? <NoticeToast tone="danger">{erro}</NoticeToast> : null}

      <div className="mt-8 grid gap-4">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome e sobrenome"
          className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
        />
        <input
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(formatarCelular(e.target.value))}
          placeholder="(17) 99999-9999"
          maxLength={15}
          className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loading ? "Salvando..." : submitLabel}
        </button>
      </div>
    </section>
  );
}
