"use client";

import type { ReactNode } from "react";

export function NoticeToast({
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
    <div
      className={`fixed left-4 right-4 top-24 z-50 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:left-auto sm:right-5 sm:top-5 sm:max-w-sm ${palette}`}
    >
      {children}
    </div>
  );
}
