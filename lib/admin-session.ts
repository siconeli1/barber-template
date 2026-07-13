const ADMIN_COOKIE_NAME = "admin_session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24;

export type AdminSessionPayload = {
  barbeiro_id: string;
  barbeiro_nome: string;
  barbeiro_login: string;
  barbeiro_cargo: "socio" | "barbeiro";
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET deve estar definido.");
  }

  return secret;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return toHex(signature);
}

export async function createAdminSessionCookie(
  session: Omit<AdminSessionPayload, "exp">,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS
) {
  const payload: AdminSessionPayload = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };

  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionCookie(cookieValue?: string | null) {
  if (!cookieValue) {
    return null;
  }

  const [encodedPayload, receivedSignature] = cookieValue.split(".");

  if (!encodedPayload || !receivedSignature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload);
  if (expectedSignature !== receivedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      decodeURIComponent(encodedPayload)
    ) as AdminSessionPayload;

    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (!payload.barbeiro_id || !payload.barbeiro_login || !payload.barbeiro_nome) {
      return null;
    }

    if (payload.barbeiro_cargo !== "socio" && payload.barbeiro_cargo !== "barbeiro") {
      payload.barbeiro_cargo = "barbeiro";
    }

    return payload;
  } catch {
    return null;
  }
}

export const ADMIN_SESSION_COOKIE_NAME = ADMIN_COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = DEFAULT_MAX_AGE_SECONDS;
