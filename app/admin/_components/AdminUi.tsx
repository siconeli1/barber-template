import type { ButtonHTMLAttributes, ReactNode } from "react";

export function AdminPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="mb-6 grid gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.26em] text-[var(--accent-strong)]">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}

export function AdminPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminMetric({
  label,
  value,
  note,
  compact = false,
}: {
  label: string;
  value: string;
  note?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.2))] ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">{label}</p>
      <p className={`font-semibold ${compact ? "mt-3 text-xl sm:text-2xl" : "mt-4 text-2xl sm:text-3xl"}`}>{value}</p>
      {note ? <p className={`text-[var(--muted)] ${compact ? "mt-1 text-xs leading-5" : "mt-2 text-sm leading-6"}`}>{note}</p> : null}
    </div>
  );
}

export function AdminNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const palette =
    tone === "success"
      ? "border-emerald-700 bg-emerald-950/40 text-emerald-100"
      : tone === "danger"
        ? "border-red-700 bg-red-950/50 text-red-100"
        : "border-white/10 bg-white/[0.04] text-[var(--foreground)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${palette}`}>{children}</div>;
}

export function AdminScopeNotice({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
      <p className="font-semibold text-[var(--accent-strong)]">{title}</p>
      {description ? <p className="mt-1 text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}

export function AdminActionButton({
  children,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  const palette =
    tone === "primary"
      ? "bg-[var(--accent)] text-black hover:bg-[var(--accent-strong)]"
      : tone === "danger"
        ? "border border-red-500 text-red-200 hover:bg-red-950/30"
        : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]";

  return (
    <button
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${palette} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function AdminToast({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const palette =
    tone === "success"
      ? "border-emerald-600/70 bg-emerald-950/95 text-emerald-100"
      : tone === "danger"
        ? "border-red-600/70 bg-red-950/95 text-red-100"
        : "border-white/15 bg-[rgba(8,12,11,0.96)] text-white";

  return (
    <div className={`fixed bottom-5 left-4 right-4 z-50 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:left-auto sm:right-5 sm:max-w-sm ${palette}`}>
      {children}
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  tone = "danger",
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  const toneStyles =
    tone === "primary"
      ? {
          badge: "border-[var(--accent)]/35 bg-[var(--accent)]/15 text-[var(--accent-strong)]",
          pulse: "bg-[radial-gradient(circle_at_center,rgba(210,169,95,0.28),rgba(210,169,95,0))]",
          confirmTone: "primary" as const,
        }
      : tone === "secondary"
        ? {
            badge: "border-white/10 bg-white/[0.06] text-white",
            pulse: "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),rgba(255,255,255,0))]",
            confirmTone: "secondary" as const,
          }
        : {
            badge: "border-red-500/35 bg-red-500/10 text-red-100",
            pulse: "bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22),rgba(239,68,68,0))]",
            confirmTone: "danger" as const,
          };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(2,5,4,0.72)] p-4 backdrop-blur-md sm:items-center"
      onClick={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,22,0.98),rgba(5,8,7,0.98))] p-6 shadow-[0_36px_80px_rgba(0,0,0,0.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 opacity-90 ${toneStyles.pulse}`} />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${toneStyles.badge}`}>
                Confirmacao
              </span>
              <h3 className="mt-4 text-2xl font-semibold text-white sm:text-[2rem]">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Fechar
            </button>
          </div>

          <p className="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">{description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <AdminActionButton
              type="button"
              tone={toneStyles.confirmTone}
              onClick={onConfirm}
              disabled={loading}
              className="min-h-12 justify-center px-6"
            >
              {loading ? "Processando..." : confirmLabel}
            </AdminActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
