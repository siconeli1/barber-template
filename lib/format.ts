import { getLocalDateInputValue, isDateBeyondLimitInTimezone, isDateInPastInTimezone } from "./date"
import { formatPhone } from "./phone"

export type Slot = {
  hora_inicio: string
  hora_fim: string
}

export function formatarData(valor: string) {
  valor = valor.replace(/\D/g, "")

  if (valor.length > 8) valor = valor.slice(0, 8)

  if (valor.length > 4) {
    return `${valor.slice(0, 2)}/${valor.slice(2, 4)}/${valor.slice(4)}`
  }

  if (valor.length > 2) {
    return `${valor.slice(0, 2)}/${valor.slice(2)}`
  }

  return valor
}

export function formatarDataISO(valor: string) {
  if (!valor || !valor.includes("-")) {
    return valor
  }

  const [ano, mes, dia] = valor.split("-")

  if (!ano || !mes || !dia) {
    return valor
  }

  return `${dia}/${mes}/${ano}`
}

export function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

export function converterParaISO(data: string) {
  if (data.length !== 10) return null

  const [dia, mes, ano] = data.split("/")

  return `${ano}-${mes}-${dia}`
}

export function formatarCelular(valor: string) {
  return formatPhone(valor)
}

export function isDateInPast(iso: string) {
  return isDateInPastInTimezone(iso)
}

export function isDateBeyondLimit(iso: string, maxDays: number) {
  return isDateBeyondLimitInTimezone(iso, maxDays)
}

export function getTodayInputValue() {
  return getLocalDateInputValue()
}

function parseIsoDateParts(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)

  if (!match) {
    return null
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!year || !month || !day) {
    return null
  }

  return { year, month, day }
}

function formatIsoDateFromParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function getNextMonthlyCycleEnd(startIso: string) {
  const parsed = parseIsoDateParts(startIso)

  if (!parsed) {
    return startIso
  }

  const nextMonthIndex = parsed.month
  const nextYear = nextMonthIndex >= 12 ? parsed.year + 1 : parsed.year
  const nextMonth = nextMonthIndex >= 12 ? 1 : nextMonthIndex + 1
  const lastDayOfNextMonth = new Date(nextYear, nextMonth, 0).getDate()
  const nextDay = Math.min(parsed.day, lastDayOfNextMonth)

  return formatIsoDateFromParts(nextYear, nextMonth, nextDay)
}

export function getDefaultMonthlyCycle(startIso = getTodayInputValue()) {
  return {
    inicioCiclo: startIso,
    fimCiclo: getNextMonthlyCycleEnd(startIso),
  }
}
