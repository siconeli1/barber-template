import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

function toHex(buffer: Uint8Array | Buffer | ArrayBuffer) {
  if (buffer instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(buffer)).toString("hex");
  }

  return Buffer.from(buffer).toString("hex");
}

export async function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function constantTimeEqual(a: string, b: string) {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  return timingSafeEqual(aBytes, bBytes);
}

export function isScryptHash(value: string) {
  return value.startsWith("scrypt$");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${toHex(salt)}$${toHex(derivedKey)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  if (isScryptHash(storedHash)) {
    const [, saltHex, hashHex] = storedHash.split("$");

    if (!saltHex || !hashHex) {
      return { matches: false, upgradedHash: null as string | null };
    }

    const derivedKey = (await scrypt(password, Buffer.from(saltHex, "hex"), SCRYPT_KEY_LENGTH)) as Buffer;
    const matches = timingSafeEqual(derivedKey, Buffer.from(hashHex, "hex"));
    return { matches, upgradedHash: null as string | null };
  }

  const legacyHash = await sha256(password);
  const matches = await constantTimeEqual(legacyHash, storedHash);
  return {
    matches,
    upgradedHash: matches ? await hashPassword(password) : null,
  };
}
