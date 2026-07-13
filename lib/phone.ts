export function normalizePhone(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidPhone(phone: string) {
  return phone.length >= 10 && phone.length <= 13
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value).slice(0, 11)

  if (digits.length > 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length > 2) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }

  if (digits.length > 0) {
    return `(${digits}`
  }

  return digits
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  )

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function getCustomerAccessCode(phone: string) {
  const normalized = normalizePhone(phone)
  const secret = process.env.CUSTOMER_ACCESS_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'conceito-barbearia'
  const hash = await digest(`${normalized}:${secret}`)
  return hash.slice(0, 8).toUpperCase()
}
