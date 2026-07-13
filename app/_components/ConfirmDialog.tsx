"use client";

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "danger",
  loading = false,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <div className="animate-fade-in-up relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#0e1916] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-50 ${
              tone === "danger"
                ? "border border-red-500/50 bg-red-950/60 text-red-300 hover:bg-red-950"
                : "bg-[var(--accent)] text-black hover:bg-[var(--accent-strong)]"
            }`}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
