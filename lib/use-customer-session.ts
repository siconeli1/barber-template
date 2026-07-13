"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { normalizePhone } from "@/lib/phone";
import barbershop from "@/barbershop.config";

export const CUSTOMER_STORAGE_KEY = `${barbershop.slug}.cliente`;
export const CUSTOMER_SESSION_EVENT = `${barbershop.slug}-customer-session`;
const STORAGE_KEY = CUSTOMER_STORAGE_KEY;
const SESSION_EVENT = CUSTOMER_SESSION_EVENT;
let cachedRawProfile: string | null | undefined;
let cachedParsedProfile: CustomerProfile | null = null;

export type CustomerProfile = {
  id: string;
  nome: string;
  telefone: string;
};

type SignInResult = {
  error: Error | null;
  profile: CustomerProfile | null;
};

type CustomerSessionContextValue = {
  profile: CustomerProfile | null;
  sessionReady: boolean;
  signIn: (telefone: string, nome?: string) => Promise<SignInResult>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

function readStoredProfile() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === cachedRawProfile) {
      return cachedParsedProfile;
    }

    cachedRawProfile = stored;
    cachedParsedProfile = stored ? (JSON.parse(stored) as CustomerProfile) : null;
    return cachedParsedProfile;
  } catch {
    cachedRawProfile = null;
    cachedParsedProfile = null;
    return null;
  }
}

function persistProfile(profile: CustomerProfile | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!profile) {
    localStorage.removeItem(STORAGE_KEY);
    cachedRawProfile = null;
    cachedParsedProfile = null;
    return;
  }

  const raw = JSON.stringify(profile);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRawProfile = raw;
  cachedParsedProfile = profile;
}

function emitSessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_EVENT));
}

function subscribeToCustomerSession(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(SESSION_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(SESSION_EVENT, handleChange);
  };
}

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const profile = useSyncExternalStore(subscribeToCustomerSession, readStoredProfile, () => null);
  const sessionReady = true;

  const signIn = useCallback(async (telefone: string, nome?: string) => {
    try {
      const tel = normalizePhone(telefone);
      const res = await fetch("/api/client/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: tel, nome: nome?.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        return { error: new Error(json.erro || "Erro ao carregar perfil."), profile: null };
      }

      const newProfile = json.profile as CustomerProfile;
      persistProfile(newProfile);
      emitSessionChange();
      return { error: null, profile: newProfile };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Erro desconhecido."), profile: null };
    }
  }, []);

  const signOut = useCallback(() => {
    persistProfile(null);
    emitSessionChange();
  }, []);

  const refresh = useCallback(async () => {
    const stored = readStoredProfile();

    if (!stored?.telefone) return;

    try {
      const res = await fetch(
        `/api/client/profile?telefone=${encodeURIComponent(stored.telefone)}`,
        { cache: "no-store" }
      );

      if (res.ok) {
        const json = await res.json();
        if (json.profile) {
          const updated = json.profile as CustomerProfile;
          persistProfile(updated);
          emitSessionChange();
        }
      }
    } catch {
      // ignorar erros de rede no refresh
    }
  }, []);

  const value = useMemo(
    () => ({ profile, sessionReady, signIn, signOut, refresh }),
    [profile, sessionReady, signIn, signOut, refresh]
  );

  return createElement(CustomerSessionContext.Provider, { value }, children);
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);

  if (!context) {
    throw new Error("useCustomerSession deve ser usado dentro de CustomerSessionProvider.");
  }

  return context;
}
