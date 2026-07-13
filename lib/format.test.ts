import assert from "node:assert/strict";
import test from "node:test";
import { converterParaISO, formatarCelular, formatarData, getDefaultMonthlyCycle, getNextMonthlyCycleEnd } from "./format.ts";

test("formatarData converte corretamente", () => {
  assert.equal(formatarData("07032026"), "07/03/2026");
  assert.equal(formatarData("0703"), "07/03");
  assert.equal(formatarData("07"), "07");
  assert.equal(formatarData(""), "");
});

test("converterParaISO retorna null para dados invalidos", () => {
  assert.equal(converterParaISO("07/03/2026"), "2026-03-07");
  assert.equal(converterParaISO("07032026"), null);
  assert.equal(converterParaISO("07/03/26"), null);
});

test("formatarCelular mantem apenas digitos e insere mascara", () => {
  assert.equal(formatarCelular("11987654321"), "(11) 98765-4321");
  assert.equal(formatarCelular("112345"), "(11) 2345");
  assert.equal(formatarCelular("1"), "(1");
  assert.equal(formatarCelular(""), "");
});

test("getNextMonthlyCycleEnd avanca para o mesmo dia no mes seguinte", () => {
  assert.equal(getNextMonthlyCycleEnd("2026-03-30"), "2026-04-30");
  assert.equal(getNextMonthlyCycleEnd("2026-12-15"), "2027-01-15");
});

test("getNextMonthlyCycleEnd limita ao ultimo dia disponivel do proximo mes", () => {
  assert.equal(getNextMonthlyCycleEnd("2026-01-31"), "2026-02-28");
});

test("getDefaultMonthlyCycle retorna inicio e fim padrao do ciclo", () => {
  assert.deepEqual(getDefaultMonthlyCycle("2026-03-30"), {
    inicioCiclo: "2026-03-30",
    fimCiclo: "2026-04-30",
  });
});
