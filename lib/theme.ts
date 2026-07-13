import type { CSSProperties } from "react";
import type { Tema } from "@/lib/barbershop-config-types";

function hexToRgbTriplet(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `${r}, ${g}, ${b}`;
}

/**
 * Converte o tema do barbershop.config em CSS variables aplicadas inline no <html>,
 * sobrescrevendo os fallbacks do globals.css. As variantes *-rgb existem para
 * composicao com transparencia via rgba(var(--accent-rgb), 0.5).
 */
export function buildThemeStyle(tema: Tema) {
  const { cores } = tema;

  return {
    "--background": cores.background,
    "--foreground": cores.foreground,
    "--surface": cores.surface,
    "--surface-strong": cores.surfaceStrong,
    "--muted": cores.muted,
    "--line": `rgba(${hexToRgbTriplet(cores.foreground)}, 0.12)`,
    "--line-strong": `rgba(${hexToRgbTriplet(cores.foreground)}, 0.24)`,
    "--accent": cores.accent,
    "--accent-strong": cores.accentStrong,
    "--accent-deep": cores.accentDeep,
    "--accent-rgb": hexToRgbTriplet(cores.accent),
    "--accent-strong-rgb": hexToRgbTriplet(cores.accentStrong),
    "--success": cores.success,
    "--danger": cores.danger,
    "--font-sans": tema.fontSans,
    "--font-mono": tema.fontMono,
  } as CSSProperties;
}
