import { AGENDA_CONFIG, getScheduleBounds, minutesToTime, timeToMinutes } from "@/lib/agenda";

type AgendaTimelineItem = {
  hora_inicio: string;
};

export function isExtraAgendaTimelineSlot(hora: string) {
  return timeToMinutes(hora) % AGENDA_CONFIG.slotMinutes !== 0;
}

export function buildAgendaTimelineTimes(day: number, items: AgendaTimelineItem[]) {
  const bounds = getScheduleBounds(day);

  if (!bounds) {
    return [];
  }

  const times = new Set<string>();

  for (let minuto = bounds.start; minuto < bounds.end; minuto += AGENDA_CONFIG.slotMinutes) {
    times.add(minutesToTime(minuto));
  }

  for (const item of items) {
    const inicio = timeToMinutes(item.hora_inicio);
    if (inicio >= bounds.start && inicio < bounds.end) {
      times.add(minutesToTime(inicio));
    }
  }

  return Array.from(times).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

export function getAgendaTimelineRowSpan(times: string[], horaInicio: string, horaFim: string) {
  const inicio = timeToMinutes(horaInicio);
  const fim = timeToMinutes(horaFim);
  const span = times.filter((hora) => {
    const minuto = timeToMinutes(hora);
    return minuto >= inicio && minuto < fim;
  }).length;

  return Math.max(1, span);
}
