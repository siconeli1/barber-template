import type { StatusAgendamento, StatusAtendimento, StatusPagamento } from "@/lib/agendamento";

type AgendamentoRuleCandidate = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  cancelavel_ate?: string | null;
  status?: string | null;
  status_agendamento?: StatusAgendamento | null;
  status_atendimento?: StatusAtendimento | null;
  status_pagamento?: StatusPagamento | null;
  origem_agendamento?: string | null;
};

const CUSTOMER_CANCEL_WINDOW_MINUTES = 120;

function timeToMinutes(hora: string) {
  const [h, m] = String(hora).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function getCurrentSaoPauloParts(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function toAbsoluteCancelMinutes(
  agendamento: Pick<AgendamentoRuleCandidate, "data" | "hora_inicio" | "cancelavel_ate">,
  referenceDate = new Date()
) {
  const current = getCurrentSaoPauloParts(referenceDate);
  const [year, month, day] = agendamento.data.split("-").map(Number);
  const [hour, minute] = agendamento.hora_inicio.slice(0, 5).split(":").map(Number);
  const appointmentMinutes = hour * 60 + minute - CUSTOMER_CANCEL_WINDOW_MINUTES;

  const appointmentDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const currentDate = current.date;

  if (appointmentDate < currentDate) return Number.NEGATIVE_INFINITY;
  if (appointmentDate > currentDate) return Number.POSITIVE_INFINITY;

  return appointmentMinutes;
}

export function hasAppointmentStarted(agendamento: Pick<AgendamentoRuleCandidate, "data" | "hora_inicio">, referenceDate = new Date()) {
  const current = getCurrentSaoPauloParts(referenceDate);

  if (agendamento.data < current.date) return true;
  if (agendamento.data > current.date) return false;
  return timeToMinutes(agendamento.hora_inicio) <= current.minutes;
}

export function hasAppointmentEnded(agendamento: Pick<AgendamentoRuleCandidate, "data" | "hora_fim">, referenceDate = new Date()) {
  const current = getCurrentSaoPauloParts(referenceDate);

  if (agendamento.data < current.date) return true;
  if (agendamento.data > current.date) return false;
  return timeToMinutes(agendamento.hora_fim) <= current.minutes;
}

export function canCancelAppointment(agendamento: AgendamentoRuleCandidate, referenceDate = new Date()) {
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false;
  if (agendamento.status_agendamento === "no_show") return false;
  if (agendamento.status_atendimento === "concluido") return false;
  const current = getCurrentSaoPauloParts(referenceDate);
  const cancelLimit = toAbsoluteCancelMinutes(agendamento, referenceDate);

  if (cancelLimit === Number.NEGATIVE_INFINITY) return false;
  if (cancelLimit === Number.POSITIVE_INFINITY) return true;

  return current.minutes <= cancelLimit;
}

export function canAdminCancelAppointment(agendamento: AgendamentoRuleCandidate) {
  if (agendamento.origem_agendamento === "horario_customizado") return false;
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false;
  return true;
}

export function canMarkNoShow(agendamento: AgendamentoRuleCandidate, referenceDate = new Date()) {
  if (agendamento.origem_agendamento === "horario_customizado") return false;
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false;
  if (agendamento.status_agendamento === "no_show") return false;
  if (agendamento.status_atendimento === "concluido") return false;
  return hasAppointmentStarted(agendamento, referenceDate);
}

export function canConcludeAppointment(agendamento: AgendamentoRuleCandidate, referenceDate = new Date()) {
  if (agendamento.origem_agendamento === "horario_customizado") return false;
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false;
  if (agendamento.status_agendamento === "no_show") return false;
  if (agendamento.status_atendimento === "concluido") return false;
  return hasAppointmentStarted(agendamento, referenceDate);
}

