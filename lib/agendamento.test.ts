import assert from "node:assert/strict";
import test from "node:test";

import { projectAutoClosedAgendamentos, shouldAutoCloseAgendamento } from "./agendamento";

test("auto conclui assim que passa da hora_fim", () => {
  const agendamento = {
    id: "1",
    data: "2026-03-30",
    hora_fim: "17:00",
    status: "ativo",
    status_agendamento: "agendado" as const,
    status_atendimento: "pendente" as const,
    status_pagamento: "pendente" as const,
    concluido_em: null,
  };

  assert.equal(shouldAutoCloseAgendamento(agendamento, new Date("2026-03-30T20:00:00.000Z")), true);
  assert.equal(shouldAutoCloseAgendamento(agendamento, new Date("2026-03-30T19:59:00.000Z")), false);
});

test("nao auto conclui quando foi marcado como no_show", () => {
  const agendamento = {
    id: "2",
    data: "2026-03-30",
    hora_fim: "17:00",
    status: "ativo",
    status_agendamento: "no_show" as const,
    status_atendimento: "pendente" as const,
    status_pagamento: "pendente" as const,
    concluido_em: null,
  };

  assert.equal(shouldAutoCloseAgendamento(agendamento, new Date("2026-03-30T20:00:00.000Z")), false);
});

test("projecao marca atendimento como concluido depois da hora_fim", () => {
  const projected = projectAutoClosedAgendamentos([
    {
      id: "3",
      data: "2026-03-30",
      hora_fim: "17:00",
      status: "ativo",
      status_agendamento: "confirmado" as const,
      status_atendimento: "pendente" as const,
      status_pagamento: "pendente" as const,
      concluido_em: null,
    },
  ], new Date("2026-03-30T20:00:00.000Z"));

  assert.equal(projected[0]?.status_atendimento, "concluido");
  assert.equal(projected[0]?.status_agendamento, "confirmado");
});
