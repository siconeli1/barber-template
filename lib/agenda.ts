export type DailyPeriod = {
  start: string
  end: string
}

export type DailySchedule = {
  periods: DailyPeriod[]
}

export const DAILY_SCHEDULE: Record<number, DailySchedule> = {
  1: {
    periods: [{ start: '09:00', end: '19:00' }],
  },
  2: {
    periods: [{ start: '09:00', end: '19:00' }],
  },
  3: {
    periods: [{ start: '09:00', end: '19:00' }],
  },
  4: {
    periods: [{ start: '09:00', end: '20:00' }],
  },
  5: {
    periods: [{ start: '08:00', end: '20:00' }],
  },
  6: {
    periods: [{ start: '09:00', end: '15:00' }],
  },
}

export const AGENDA_CONFIG = {
  timezone: 'America/Sao_Paulo',
  openDays: Object.keys(DAILY_SCHEDULE).map((d) => Number(d)),
  slotMinutes: 30,
  visibleSlotMinutes: 30,
}

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number) {
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function getScheduleForDay(day: number) {
  return DAILY_SCHEDULE[day] ?? null
}

export function getScheduleBounds(day: number) {
  const schedule = getScheduleForDay(day)

  if (!schedule) {
    return null
  }

  const firstPeriod = schedule.periods[0]
  const lastPeriod = schedule.periods[schedule.periods.length - 1]

  return {
    start: timeToMinutes(firstPeriod.start),
    end: timeToMinutes(lastPeriod.end),
  }
}

export function isAppointmentWithinSchedule(day: number, startMinutes: number, durationMinutes: number) {
  const schedule = getScheduleForDay(day)

  if (!schedule) {
    return false
  }

  const endMinutes = startMinutes + durationMinutes

  return schedule.periods.some((period) => {
    const periodStart = timeToMinutes(period.start)
    const periodEnd = timeToMinutes(period.end)

    return startMinutes >= periodStart && endMinutes <= periodEnd
  })
}

export function generateSlots(day: number, durationMinutes = AGENDA_CONFIG.slotMinutes) {
  const schedule = getScheduleForDay(day)

  if (!schedule) {
    return []
  }

  const step = AGENDA_CONFIG.slotMinutes
  const slots: { hora_inicio: string; hora_fim: string }[] = []

  for (const period of schedule.periods) {
    const start = timeToMinutes(period.start)
    const end = timeToMinutes(period.end)
    const maxStart = end - durationMinutes

    for (let t = start; t <= maxStart; t += step) {
      slots.push({
        hora_inicio: minutesToTime(t),
        hora_fim: minutesToTime(t + durationMinutes),
      })
    }
  }

  return slots
}

export function generateCandidateStartTimes(day: number, durationMinutes: number) {
  return generateSlots(day, durationMinutes).map((slot) => timeToMinutes(slot.hora_inicio))
}

export function reduceVisibleSlots(slots: { hora_inicio: string; hora_fim: string }[]) {
  if (slots.length <= 1) {
    return slots
  }

  const visibleStep = AGENDA_CONFIG.visibleSlotMinutes
  return slots.filter((slot) => timeToMinutes(slot.hora_inicio) % visibleStep === 0)
}

function getCurrentDateParts(referenceDate: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(referenceDate)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

export function filterPastSlotsForDate(
  date: string,
  slots: { hora_inicio: string; hora_fim: string }[],
  referenceDate = new Date(),
  timeZone = AGENDA_CONFIG.timezone
) {
  const current = getCurrentDateParts(referenceDate, timeZone)

  if (date !== current.date) {
    return slots
  }

  return slots.filter((slot) => timeToMinutes(slot.hora_inicio) > current.minutes)
}
