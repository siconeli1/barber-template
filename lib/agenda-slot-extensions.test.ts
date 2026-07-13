import assert from "node:assert/strict";
import test from "node:test";
import { buildHalfHourSlots, buildShortServiceFollowUpSlots } from "./agenda-slot-extensions";

test("10-minute service keeps half-hour grid when block is empty", () => {
  const slots = buildHalfHourSlots(2, 10);
  const starts = slots.slice(0, 6).map((slot) => slot.hora_inicio);

  assert.deepEqual(starts, ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  assert.ok(!slots.some((slot) => slot.hora_inicio === "09:15"));
  assert.ok(!slots.some((slot) => slot.hora_inicio === "09:45"));
});

test("10-minute service opens a 15-minute-offset slot after a short booking on the half-hour", () => {
  const slots = buildShortServiceFollowUpSlots(2, 10, [{ inicio: 1050, fim: 1060, permite_encaixe_curto: true }]);
  const starts = slots.map((slot) => slot.hora_inicio);

  assert.ok(starts.includes("17:45"));
  assert.ok(!starts.includes("17:15"));
});

test("longer services do not create quarter-hour follow-up slots", () => {
  const slots = buildShortServiceFollowUpSlots(2, 30, [{ inicio: 1050, fim: 1060, permite_encaixe_curto: true }]);
  assert.deepEqual(slots, []);
});

test("custom short intervals do not open a 15-minute follow-up slot without explicit short-service flag", () => {
  const slots = buildShortServiceFollowUpSlots(2, 10, [{ inicio: 1050, fim: 1060 }]);
  assert.deepEqual(slots, []);
});

test("only exact 10-minute bookings open the 15-minute follow-up slot", () => {
  const slots = buildShortServiceFollowUpSlots(2, 10, [{ inicio: 1050, fim: 1055, permite_encaixe_curto: true }]);
  assert.deepEqual(slots, []);
});
