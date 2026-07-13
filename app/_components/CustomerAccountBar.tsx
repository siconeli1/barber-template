"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useCustomerSession } from "@/lib/use-customer-session";

const NAV_ITEMS = [
  { href: "/agendar", label: "Agendar" },
  { href: "/meus-agendamentos", label: "Meus agendamentos", mobileLabel: "Agendamentos" },
  { href: "/minha-conta", label: "Minha conta" },
];

export function CustomerAccountBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useCustomerSession();

  if (pathname === "/" || pathname?.startsWith("/admin")) {
    return null;
  }

  const primeiroNome = profile?.nome?.split(" ")[0] ?? null;

  const handleCustomerLogout = () => {
    signOut();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(4,7,6,0.88)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-base font-semibold uppercase tracking-[0.2em] text-white sm:text-lg">
              Imperio Ferreira
            </Link>
            <div className="flex items-center gap-3 sm:hidden">
              {primeiroNome ? (
                <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">
                  {primeiroNome}
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleCustomerLogout}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.02] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
              >
                Sair
              </button>
            </div>
          </div>

          <nav className="pb-1 sm:pb-0">
            <div className="flex items-center gap-3">
              {primeiroNome ? (
                <span className="hidden rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] sm:inline-flex sm:items-center">
                  {primeiroNome}
                </span>
              ) : null}
              <div className="grid grid-cols-3 gap-2 sm:flex sm:min-w-max">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex min-h-10 min-w-0 items-center justify-center rounded-full px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.08em] transition sm:px-4 sm:text-sm sm:normal-case sm:tracking-normal ${
                        active
                          ? "bg-[var(--accent)] text-black"
                          : "border border-white/10 bg-white/[0.03] text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <span className="truncate sm:hidden">{item.mobileLabel ?? item.label}</span>
                      <span className="hidden truncate sm:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
