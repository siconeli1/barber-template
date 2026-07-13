const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

function getDateFormatter(timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function getLocalDateInputValue(referenceDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getDateFormatter(timeZone).formatToParts(referenceDate)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>

  return `${values.year}-${values.month}-${values.day}`
}

export function isDateInPastInTimezone(iso: string, timeZone = DEFAULT_TIMEZONE) {
  return iso < getLocalDateInputValue(new Date(), timeZone)
}

export function isDateBeyondLimitInTimezone(iso: string, maxDays: number, timeZone = DEFAULT_TIMEZONE) {
  const todayIso = getLocalDateInputValue(new Date(), timeZone)
  const today = new Date(`${todayIso}T00:00:00`)
  const target = new Date(`${iso}T00:00:00`)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays > maxDays
}
