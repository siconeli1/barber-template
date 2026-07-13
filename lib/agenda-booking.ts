import {
  AGENDA_CONFIG,
  filterPastSlotsForDate,
  isAppointmentWithinSchedule,
  minutesToTime,
  reduceVisibleSlots,
  timeToMinutes,
} from "@/lib/agenda";
import { getBusyIntervals, overlaps } from "@/lib/agenda-conflicts";
import { listActiveBarbeiros } from "@/lib/barbeiros";
import { isDateBeyondLimitInTimezone, isDateInPastInTimezone } from "@/lib/date";
import type { BusyState } from "@/lib/agenda-conflicts";
import { buildHalfHourSlots, buildShortServiceFollowUpSlots, shouldExposeAllVisibleSlots } from "@/lib/agenda-slot-extensions";

export const CUSTOMER_BOOKING_MAX_DAYS_AHEAD = 30;

export type AvailableSlot = {
  hora_inicio: string;
  hora_fim: string;
  barbeiros_disponiveis: string[];
};

type SlotValidationResult =
  | { ok: false; erro: string }
  | { ok: true; day: number; inicioReserva: number; fimReserva: number };

type DateValidationResult =
  | { ok: false; erro: string }
  | { ok: true };

export function buildFreeSlotsForBusyState(data: string, day: number, duration: number, busyState: BusyState) {
  if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
    return [];
  }

  const candidatos = [
    ...buildHalfHourSlots(day, duration),
    ...buildShortServiceFollowUpSlots(day, duration, busyState.intervalos),
  ];

  const slots = filterPastSlotsForDate(
    data,
    candidatos
  );

  return Array.from(
    new Map(
      slots
        .map((slot) => ({
          ...slot,
          inicio: timeToMinutes(slot.hora_inicio),
          fim: timeToMinutes(slot.hora_fim),
        }))
        .filter((slot) => {
          return !busyState.intervalos.some((intervalo) =>
            overlaps(slot.inicio, slot.fim, intervalo.inicio, intervalo.fim)
          );
        })
        .map(({ hora_inicio, hora_fim, inicio }) => [
          `${inicio}-${hora_fim}`,
          { hora_inicio, hora_fim },
        ])
    ).values()
  ).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
}

export function isAllowedSlotForBusyState(
  data: string,
  day: number,
  duration: number,
  horaInicio: string,
  busyState: BusyState
) {
  const normalizedStart = minutesToTime(timeToMinutes(horaInicio));

  return buildFreeSlotsForBusyState(data, day, duration, busyState).some(
    (slot) => slot.hora_inicio === normalizedStart
  );
}

function buildFreeSlots(data: string, day: number, duration: number, busyState: Awaited<ReturnType<typeof getBusyIntervals>>) {
  return buildFreeSlotsForBusyState(data, day, duration, busyState)
    .map((slot) => ({
      ...slot,
      inicio: timeToMinutes(slot.hora_inicio),
      fim: timeToMinutes(slot.hora_fim),
    }))
    .map(({ hora_inicio, hora_fim }) => ({ hora_inicio, hora_fim }));
}

export async function getAvailableSlots(params: {
  data: string;
  duracao: number;
  barbeiroId?: string | null;
}) {
  const d = new Date(`${params.data}T00:00:00`);
  const day = d.getDay();

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return {
      horarios: [] as AvailableSlot[],
      horarios_completos: [] as AvailableSlot[],
    };
  }

  if (params.barbeiroId) {
    const busyState = await getBusyIntervals(params.data, params.barbeiroId);
    const completos = buildFreeSlots(params.data, day, params.duracao, busyState).map((slot) => ({
      ...slot,
      barbeiros_disponiveis: [params.barbeiroId!],
    }));

    return {
      horarios: shouldExposeAllVisibleSlots(params.duracao) ? completos : reduceVisibleSlots(completos),
      horarios_completos: completos,
    };
  }

  const barbeiros = await listActiveBarbeiros();
  const slotMap = new Map<string, AvailableSlot>();

  for (const barbeiro of barbeiros) {
    const busyState = await getBusyIntervals(params.data, barbeiro.id);
    const livres = buildFreeSlots(params.data, day, params.duracao, busyState);

    for (const slot of livres) {
      const key = `${slot.hora_inicio}-${slot.hora_fim}`;
      const current = slotMap.get(key);

      if (current) {
        current.barbeiros_disponiveis.push(barbeiro.id);
      } else {
        slotMap.set(key, {
          ...slot,
          barbeiros_disponiveis: [barbeiro.id],
        });
      }
    }
  }

  const completos = Array.from(slotMap.values()).sort((a, b) =>
    a.hora_inicio.localeCompare(b.hora_inicio)
  );

  return {
    horarios: shouldExposeAllVisibleSlots(params.duracao) ? completos : reduceVisibleSlots(completos),
    horarios_completos: completos,
  };
}

export function validateCustomerBookingDate(data: string): DateValidationResult {
  if (isDateInPastInTimezone(data, AGENDA_CONFIG.timezone)) {
    return { ok: false, erro: "Não é possível agendar em uma data passada." };
  }

  if (isDateBeyondLimitInTimezone(data, CUSTOMER_BOOKING_MAX_DAYS_AHEAD, AGENDA_CONFIG.timezone)) {
    return { ok: false, erro: `Escolha uma data em ate ${CUSTOMER_BOOKING_MAX_DAYS_AHEAD} dias.` };
  }

  return { ok: true };
}

export function validateBusinessSlot(
  data: string,
  horaInicio: string,
  duracao: number
): SlotValidationResult {
  const day = new Date(`${data}T00:00:00`).getDay();
  const inicioReserva = timeToMinutes(horaInicio);

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return { ok: false, erro: "Data fora do funcionamento" };
  }

  if (!isAppointmentWithinSchedule(day, inicioReserva, duracao)) {
    return { ok: false, erro: "Não há tempo suficiente para este serviço nesse horário." };
  }

  return {
    ok: true,
    day,
    inicioReserva,
    fimReserva: inicioReserva + duracao,
  };
}

function parseStrictTimeToMinutes(hora: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}

export function validateAdminManualSlot(
  data: string,
  horaInicio: string,
  duracao: number
): SlotValidationResult {
  const parsedDate = new Date(`${data}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, erro: "Data inválida." };
  }

  const inicioReserva = parseStrictTimeToMinutes(horaInicio);
  if (inicioReserva === null) {
    return { ok: false, erro: "Horário inválido." };
  }

  if (!Number.isFinite(duracao) || duracao <= 0) {
    return { ok: false, erro: "Duração do serviço inválida." };
  }

  const fimReserva = inicioReserva + duracao;
  if (fimReserva > 24 * 60) {
    return {
      ok: false,
      erro: "Horário final excede o mesmo dia. Ajuste o horário de início ou escolha um serviço mais curto.",
    };
  }

  return {
    ok: true,
    day: parsedDate.getDay(),
    inicioReserva,
    fimReserva,
  };
}
