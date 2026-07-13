import { supabase } from "@/lib/supabase";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const BLOCK_MINUTES = 15;

type AttemptRow = {
  key: string;
  attempts: number;
  window_started_at: string;
  blocked_until: string | null;
};

function isMissingRateLimitStorageError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("admin_login_attempts") &&
    (normalized.includes("could not find the table") ||
      normalized.includes("relation") ||
      normalized.includes("does not exist") ||
      normalized.includes("schema cache"))
  );
}

function addMinutes(reference: Date, minutes: number) {
  const date = new Date(reference);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function buildKeys(login: string, ip: string) {
  const normalizedLogin = login.trim().toLowerCase();
  const normalizedIp = ip.trim() || "unknown";
  return [
    `ip:${normalizedIp}`,
    `login:${normalizedLogin}`,
    `login_ip:${normalizedLogin}:${normalizedIp}`,
  ];
}

async function loadAttempts(keys: string[]) {
  const { data, error } = await supabase
    .from("admin_login_attempts")
    .select("key, attempts, window_started_at, blocked_until")
    .in("key", keys);

  if (error) {
    if (isMissingRateLimitStorageError(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as AttemptRow[];
}

export async function assertAdminLoginAllowed(login: string, ip: string) {
  const now = new Date();
  const rows = await loadAttempts(buildKeys(login, ip));
  const blocked = rows.find((row) => row.blocked_until && new Date(row.blocked_until) > now);

  if (!blocked) {
    return;
  }

  const blockedUntil = new Date(blocked.blocked_until as string);
  const remainingMinutes = Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 60000));
  throw new Error(`Muitas tentativas de acesso. Tente novamente em ${remainingMinutes} minuto(s).`);
}

async function upsertAttempt(key: string, now: Date) {
  const rows = await loadAttempts([key]);
  const current = rows[0] ?? null;
  const windowStartedAt = current ? new Date(current.window_started_at) : now;
  const sameWindow = current && now.getTime() - windowStartedAt.getTime() < WINDOW_MINUTES * 60000;
  const attempts = sameWindow ? current.attempts + 1 : 1;
  const blockedUntil = attempts >= MAX_ATTEMPTS ? addMinutes(now, BLOCK_MINUTES).toISOString() : null;

  const { error } = await supabase.from("admin_login_attempts").upsert({
    key,
    attempts,
    window_started_at: sameWindow ? current!.window_started_at : now.toISOString(),
    blocked_until: blockedUntil,
    updated_at: now.toISOString(),
  });

  if (error) {
    if (isMissingRateLimitStorageError(error.message)) {
      return;
    }
    throw new Error(error.message);
  }
}

export async function registerAdminLoginFailure(login: string, ip: string) {
  const now = new Date();

  for (const key of buildKeys(login, ip)) {
    await upsertAttempt(key, now);
  }
}

export async function clearAdminLoginFailures(login: string, ip: string) {
  const keys = buildKeys(login, ip);
  const { error } = await supabase.from("admin_login_attempts").delete().in("key", keys);

  if (error) {
    if (isMissingRateLimitStorageError(error.message)) {
      return;
    }
    throw new Error(error.message);
  }
}
