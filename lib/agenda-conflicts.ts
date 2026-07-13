import { supabase } from "@/lib/supabase";
import { listActiveBarbeiros } from "@/lib/barbeiros";

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = String(timeStr).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

export type BusyInterval = {
  inicio: number;
  fim: number;
  tipo: "agendamento" | "horario_customizado" | "bloqueio";
  permite_encaixe_curto?: boolean;
};

export type BusyState = {
  bloqueioDiaInteiro: boolean;
  naoAceitarMais: boolean;
  intervalos: BusyInterval[];
};

export async function getBusyIntervals(data: string, barbeiroId: string, ignoreCustomId?: string) {
  const [agendadosRes, customRes, bloqueiosRes] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("hora_inicio, hora_fim, status, status_agendamento, servico_duracao_minutos")
      .eq("data", data)
      .eq("barbeiro_id", barbeiroId),
    ignoreCustomId
      ? supabase
          .from("horarios_customizados")
          .select("id, hora_inicio, hora_fim")
          .eq("data", data)
          .eq("barbeiro_id", barbeiroId)
          .neq("id", ignoreCustomId)
      : supabase
          .from("horarios_customizados")
          .select("id, hora_inicio, hora_fim")
          .eq("data", data)
          .eq("barbeiro_id", barbeiroId),
    supabase
      .from("bloqueios_agenda")
      .select("hora_inicio, hora_fim, dia_inteiro, tipo_bloqueio")
      .eq("data", data)
      .eq("barbeiro_id", barbeiroId),
  ]);

  if (agendadosRes.error) {
    throw new Error(agendadosRes.error.message);
  }

  if (customRes.error) {
    throw new Error(customRes.error.message);
  }

  if (bloqueiosRes.error) {
    throw new Error(bloqueiosRes.error.message);
  }

  const bloqueios = bloqueiosRes.data ?? [];
  const bloqueioDiaInteiro = bloqueios.some((item) => item.dia_inteiro || item.tipo_bloqueio === "dia_inteiro");
  const naoAceitarMais = bloqueios.some((item) => item.tipo_bloqueio === "nao_aceitar_mais");

  return {
    bloqueioDiaInteiro,
    naoAceitarMais,
    intervalos: [
      ...(agendadosRes.data ?? [])
        .filter((item) => item.status_agendamento ? item.status_agendamento !== "cancelado" : item.status === "ativo")
        .map((item) => ({
          inicio: parseTimeToMinutes(String(item.hora_inicio)),
          fim: parseTimeToMinutes(String(item.hora_fim)),
          tipo: "agendamento" as const,
          permite_encaixe_curto: Number(item.servico_duracao_minutos) === 10,
        })),
      ...(customRes.data ?? []).map((item) => ({
        inicio: parseTimeToMinutes(String(item.hora_inicio)),
        fim: parseTimeToMinutes(String(item.hora_fim)),
        tipo: "horario_customizado" as const,
      })),
      ...bloqueios
        .filter((item) => !item.dia_inteiro && item.tipo_bloqueio === "horario" && item.hora_inicio && item.hora_fim)
        .map((item) => ({
          inicio: parseTimeToMinutes(String(item.hora_inicio)),
          fim: parseTimeToMinutes(String(item.hora_fim)),
          tipo: "bloqueio" as const,
        })),
    ],
  } satisfies BusyState;
}

export async function getAnyAvailableBarber(
  data: string,
  inicio: number,
  fim: number
) {
  const barbeiros = await listActiveBarbeiros();

  for (const barbeiro of barbeiros) {
    const busyState = await getBusyIntervals(data, barbeiro.id);

    if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
      continue;
    }

    const hasConflict = busyState.intervalos.some((intervalo) =>
      overlaps(inicio, fim, intervalo.inicio, intervalo.fim)
    );

    if (!hasConflict) {
      return barbeiro;
    }
  }

  return null;
}
