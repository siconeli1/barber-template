import { AGENDA_CONFIG, generateCandidateStartTimes, isAppointmentWithinSchedule, minutesToTime, timeToMinutes } from "@/lib/agenda";

export type BusyIntervalLike = {
  inicio: number;
  fim: number;
  permite_encaixe_curto?: boolean;
};

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

const SHORT_SERVICE_DURATION_MINUTES = 10;
const SHORT_SERVICE_SECOND_SLOT_OFFSET_MINUTES = 15;

export function buildHalfHourSlots(day: number, duration: number) {
  return generateCandidateStartTimes(day, duration).map((inicio) => ({
    hora_inicio: minutesToTime(inicio),
    hora_fim: minutesToTime(inicio + duration),
  }));
}

export function buildShortServiceFollowUpSlots(
  day: number,
  duration: number,
  intervalos: BusyIntervalLike[]
) {
  if (duration !== SHORT_SERVICE_DURATION_MINUTES) {
    return [];
  }

  const horariosExtras: Array<{ hora_inicio: string; hora_fim: string }> = [];
  const daySlots = buildHalfHourSlots(day, duration);

  for (const slot of daySlots) {
    const inicioBase = timeToMinutes(slot.hora_inicio);
    const inicioExtra = inicioBase + SHORT_SERVICE_SECOND_SLOT_OFFSET_MINUTES;
    const fimExtra = inicioExtra + duration;

    if (!isAppointmentWithinSchedule(day, inicioExtra, duration)) {
      continue;
    }

    const hasLeadingBooking = intervalos.some(
      (intervalo) =>
        intervalo.permite_encaixe_curto === true &&
        intervalo.inicio === inicioBase &&
        intervalo.fim === inicioBase + SHORT_SERVICE_DURATION_MINUTES
    );

    if (!hasLeadingBooking) {
      continue;
    }

    const hasConflict = intervalos.some((intervalo) =>
      overlaps(inicioExtra, fimExtra, intervalo.inicio, intervalo.fim)
    );

    if (hasConflict) {
      continue;
    }

    horariosExtras.push({
      hora_inicio: minutesToTime(inicioExtra),
      hora_fim: minutesToTime(fimExtra),
    });
  }

  return horariosExtras;
}

export function shouldExposeAllVisibleSlots(duration: number) {
  return duration === SHORT_SERVICE_DURATION_MINUTES;
}

export function getAgendaSlotDuration() {
  return AGENDA_CONFIG.slotMinutes;
}
