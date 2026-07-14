import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENDA_CONFIG,
  DAILY_SCHEDULE,
  filterPastSlotsForDate,
  generateCandidateStartTimes,
  generateSlots,
  reduceVisibleSlots,
  timeToMinutes,
} from "./agenda.ts";
import barbershop from "../barbershop.config.ts";

// Os testes derivam as expectativas do barbershop.config.ts para valerem
// em qualquer cliente do template, nao apenas na config ativa.
const diasAbertos = Object.keys(barbershop.horarios)
  .map(Number)
  .sort((a, b) => a - b);

test("daily schedule map matches barbershop config", () => {
  assert.deepEqual(
    Object.keys(DAILY_SCHEDULE).map(Number).sort((a, b) => a - b),
    diasAbertos
  );
  assert.deepEqual([...AGENDA_CONFIG.openDays].sort((a, b) => a - b), diasAbertos);
});

test("generateSlots returns empty for non-working day", () => {
  const diaFechado = [0, 1, 2, 3, 4, 5, 6].find((dia) => !barbershop.horarios[dia]) ?? -1;
  assert.deepEqual(generateSlots(diaFechado, 30), []);
});

test("30-minute grid covers each open day from opening to closing", () => {
  for (const dia of diasAbertos) {
    const periodos = barbershop.horarios[dia];
    const slots = generateSlots(dia, 30);

    assert.equal(slots[0]?.hora_inicio, periodos[0].inicio);
    assert.equal(slots[slots.length - 1]?.hora_fim, periodos[periodos.length - 1].fim);
  }
});

test("60-minute service can finish exactly at closing time", () => {
  for (const dia of diasAbertos) {
    const periodos = barbershop.horarios[dia];
    const slots = generateSlots(dia, 60);
    const last = slots[slots.length - 1];

    assert.equal(last?.hora_fim, periodos[periodos.length - 1].fim);
    assert.equal(timeToMinutes(last!.hora_fim) - timeToMinutes(last!.hora_inicio), 60);
  }
});

test("candidate starts stay on half-hour grid", () => {
  const primeiroDia = diasAbertos[0];
  const abertura = timeToMinutes(barbershop.horarios[primeiroDia][0].inicio);
  const starts = generateCandidateStartTimes(primeiroDia, 30);

  assert.ok(starts.includes(abertura));
  assert.ok(starts.includes(abertura + 30));
  assert.ok(!starts.includes(abertura + 10));
});

test("visible slots keep the half-hour grid unchanged", () => {
  const visible = reduceVisibleSlots([
    { hora_inicio: "17:00", hora_fim: "17:30" },
    { hora_inicio: "17:30", hora_fim: "18:00" },
    { hora_inicio: "18:00", hora_fim: "18:30" },
  ]);

  assert.deepEqual(visible, [
    { hora_inicio: "17:00", hora_fim: "17:30" },
    { hora_inicio: "17:30", hora_fim: "18:00" },
    { hora_inicio: "18:00", hora_fim: "18:30" },
  ]);
});

test("filterPastSlotsForDate removes slots already passed for today", () => {
  const slots = [
    { hora_inicio: "16:30", hora_fim: "17:00" },
    { hora_inicio: "17:00", hora_fim: "17:30" },
    { hora_inicio: "17:30", hora_fim: "18:00" },
    { hora_inicio: "18:00", hora_fim: "18:30" },
  ];

  const filtered = filterPastSlotsForDate(
    "2026-03-10",
    slots,
    new Date("2026-03-10T20:00:00.000Z"),
    "America/Sao_Paulo"
  );

  assert.deepEqual(filtered, [
    { hora_inicio: "17:30", hora_fim: "18:00" },
    { hora_inicio: "18:00", hora_fim: "18:30" },
  ]);
});
