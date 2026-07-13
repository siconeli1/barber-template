import { normalizePhone } from "@/lib/phone";

export function getWhatsAppLink(phone?: string | null, message?: string | null) {
  const digits = normalizePhone(phone);
  if (!digits) {
    return null;
  }

  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${query}`;
}
