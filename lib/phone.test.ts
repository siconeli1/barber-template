import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhone } from "./phone";

test("normalizePhone remove o DDI 55 enviado pelo Telegram", () => {
  assert.equal(normalizePhone("5511999998888"), "11999998888");
  assert.equal(normalizePhone("+55 (11) 3333-4444"), "1133334444");
});

test("normalizePhone mantem numeros nacionais, inclusive com DDD 55", () => {
  assert.equal(normalizePhone("(11) 99999-8888"), "11999998888");
  assert.equal(normalizePhone("55999998888"), "55999998888");
});
