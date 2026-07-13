"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AdminShellProps = {
  children: React.ReactNode;
};

type BarbeiroLogado = {
  id: string;
  nome: string;
  login: string;
  cargo: "socio" | "barbeiro";
};

const BASE_MENU_ITEMS = [
  { href: "/admin", label: "Agenda", match: "/admin" },
  { href: "/admin/bloqueios", label: "Bloqueios", match: "/admin/bloqueios" },
  { href: "/admin/marcar", label: "Marcar horários", match: "/admin/marcar" },
  { href: "/admin/clientes", label: "Clientes", match: "/admin/clientes" },
  { href: "/admin/financeiro", label: "Financeiro", match: "/admin/financeiro" },
  { href: "/admin/planos", label: "Planos", match: "/admin/planos" },
] as const;

const SOCIO_MENU_ITEM = { href: "/admin/agenda-geral", label: "Agenda geral", match: "/admin/agenda-geral" } as const;

function isItemActive(pathname: string, match: string) {
  if (match === "/admin") {
    return pathname === "/admin";
  }

  return pathname === match || pathname.startsWith(`${match}/`);
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [barbeiro, setBarbeiro] = useState<BarbeiroLogado | null>(null);
  const [loading, setLoading] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const menuItems = useMemo(
    () =>
      barbeiro?.cargo === "socio"
        ? [BASE_MENU_ITEMS[0], SOCIO_MENU_ITEM, ...BASE_MENU_ITEMS.slice(1)]
        : BASE_MENU_ITEMS,
    [barbeiro]
  );
  const allMenuItems = useMemo(() => [BASE_MENU_ITEMS[0], SOCIO_MENU_ITEM, ...BASE_MENU_ITEMS.slice(1)], []);

  const activeItem = useMemo(
    () => allMenuItems.find((item) => isItemActive(pathname || "", item.match)) ?? BASE_MENU_ITEMS[0],
    [allMenuItems, pathname]
  );

  useEffect(() => {
    if (!pathname || pathname === "/admin/login") {
      setSaindo(false);
      setBarbeiro(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setSaindo(false);
    setLoading(true);

    async function carregarBarbeiro() {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!cancelled) {
          setBarbeiro(json.barbeiro ?? null);
        }
      } catch {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void carregarBarbeiro();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function sair() {
    setSaindo(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
    }
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(4,7,6,0.92)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/admin" className="text-base font-semibold uppercase tracking-[0.24em] text-white sm:text-lg">
                  Imperio Ferreira
                </Link>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  Painel administrativo
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                <span>{loading ? "Carregando painel..." : `${barbeiro?.nome ?? "Barbeiro"} - @${barbeiro?.login ?? "-"}`}</span>
                {!loading && barbeiro ? (
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    {barbeiro.cargo === "socio" ? "Sócio" : "Barbeiro"}
                  </span>
                ) : null}
                <span className="hidden lg:inline">Agenda, bloqueios, clientes, financeiro e planos em um único menu.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)] sm:px-4 sm:text-sm sm:normal-case sm:tracking-normal">
                {activeItem.label}
              </div>
              <button
                type="button"
                onClick={sair}
                disabled={saindo}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60"
              >
                {saindo ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>

          <nav className="mt-3 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {menuItems.map((item) => {
                const active = isItemActive(pathname || "", item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                      active
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/10 bg-white/[0.04] text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
