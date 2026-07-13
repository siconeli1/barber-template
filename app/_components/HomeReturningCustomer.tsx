"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

type SessionData = { id: string; nome: string; telefone: string };

let cachedRawSession: string | null | undefined;
let cachedParsedSession: SessionData | null = null;

function readCustomerSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem("imperio.cliente");
    if (raw === cachedRawSession) {
      return cachedParsedSession;
    }

    cachedRawSession = raw;

    if (!raw) {
      cachedParsedSession = null;
      return cachedParsedSession;
    }

    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.nome || !parsed?.telefone) {
      cachedParsedSession = null;
      return cachedParsedSession;
    }

    cachedParsedSession = parsed;
    return cachedParsedSession;
  } catch {
    cachedRawSession = null;
    cachedParsedSession = null;
    return cachedParsedSession;
  }
}

function subscribeToCustomerSession(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === "imperio.cliente") {
      onStoreChange();
    }
  };

  const handleCustom = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("imperio-customer-session", handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("imperio-customer-session", handleCustom);
  };
}

export function HomeReturningCustomer() {
  const session = useSyncExternalStore(subscribeToCustomerSession, readCustomerSession, () => null);

  if (!session) {
    return null;
  }

  const primeiroNome = session.nome.split(" ")[0];

  return (
    <section className="animate-fade-in-up rounded-[28px] border border-[var(--accent)]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Bem-vindo de volta
          </p>
          <p className="mt-2 text-lg font-semibold text-white">{primeiroNome}</p>
          <p className="text-sm text-[var(--muted)]">{session.telefone}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/agendar"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
          >
            Agendar novamente
          </Link>
          <Link
            href="/meus-agendamentos"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Meus agendamentos
          </Link>
        </div>
      </div>
    </section>
  );
}
