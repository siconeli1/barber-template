import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENDA_CONFIG,
  DAILY_SCHEDULE,
  filterPastSlotsForDate,
  generateCandidateStartTimes,
  generateSlots,
  reduceVisibleSlots,
} from "./agenda.ts";

test("daily schedule map contains correct keys", () => {
  assert.deepEqual(Object.keys(DAILY_SCHEDULE).sort(), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(AGENDA_CONFIG.openDays, [1, 2, 3, 4, 5, 6]);
});

test("generateSlots returns empty for non-working day", () => {
  assert.deepEqual(generateSlots(0, 30), []);
});

test("monday to wednesday finish at 19:00 with 30-minute grid", () => {
  const slots = generateSlots(2, 30);
  assert.equal(slots[0]?.hora_inicio, "09:00");

  const last = slots[slots.length - 1];
  assert.equal(last?.hora_inicio, "18:30");
  assert.equal(last?.hora_fim, "19:00");
});

test("60-minute service on monday to wednesday can start at 18:00 and finish at 19:00", () => {
  const slots = generateSlots(3, 60);
  const last = slots[slots.length - 1];

  assert.equal(last?.hora_inicio, "18:00");
  assert.equal(last?.hora_fim, "19:00");
});

test("friday starts at 08:00 and allows 60-minute service until 19:00", () => {
  const slots = generateSlots(5, 60);

  assert.equal(slots[0]?.hora_inicio, "08:00");
  assert.deepEqual(slots[slots.length - 1], {
    hora_inicio: "19:00",
    hora_fim: "20:00",
  });
});

test("saturday ends at 15:00", () => {
  const slots = generateSlots(6, 60);
  const last = slots[slots.length - 1];

  assert.equal(last?.hora_inicio, "14:00");
  assert.equal(last?.hora_fim, "15:00");
});

test("candidate starts stay on half-hour grid", () => {
  const starts = generateCandidateStartTimes(2, 30);

  assert.ok(starts.includes(540));
  assert.ok(starts.includes(570));
  assert.ok(!starts.includes(550));
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
