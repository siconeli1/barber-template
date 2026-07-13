import { expect, test, type Page } from "@playwright/test";
import { getNextBusinessDayIso, setupBookingMocks, type CoverageDecision } from "./helpers";

async function completarFluxoBase(page: Page) {
  const dataValida = getNextBusinessDayIso();

  await page.goto("/agendar");

  await page.getByPlaceholder("(17) 99999-9999").fill("(17) 99999-9999");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Cadastro ativo")).toBeVisible();

  const secaoServico = page.locator("section").filter({ hasText: "1. Escolha o serviço" }).first();
  await expect(secaoServico).toBeVisible();
  await secaoServico.getByRole("button").first().click();

  await page.locator("#agendamento-data").fill(dataValida);
  await expect(page.getByRole("button", { name: "09:00" })).toBeVisible();
  await page.getByRole("button", { name: "09:00" }).click();
}

test.describe("Agendamento - fluxo critico", () => {
  test("confirma reserva com cadastro por telefone", async ({ page }) => {
    let reservaBody: Record<string, unknown> | null = null;

    await setupBookingMocks(page, {
      onReserveRequest: (body) => {
        reservaBody = body;
      },
    });

    await completarFluxoBase(page);

    await page.locator("aside").getByRole("button", { name: "Confirmar agendamento" }).click();

    await expect(page.getByText("Seu atendimento")).toBeVisible();
    await expect(page.getByText(/Barbeiro:\s*Barbeiro 1/)).toBeVisible();

    expect(reservaBody).not.toBeNull();
    expect(reservaBody?.confirmar_avulso).toBeFalsy();
  });

  test("forca confirmacao avulsa quando plano nao cobre o servico", async ({ page }) => {
    let reservaBody: Record<string, unknown> | null = null;

    const coverage: CoverageDecision = {
      status: "nao_coberto",
      confirmar_como: "avulso",
      servico_referencia: "sobrancelha",
      mensagem: "O seu plano nao cobre esse tipo de servico, gostaria de agendar com pagamento avulso?",
      warning_tone: "warning",
      requires_avulso_confirmation: true,
    };

    await setupBookingMocks(page, {
      coverage,
      onReserveRequest: (body) => {
        reservaBody = body;
      },
    });

    await completarFluxoBase(page);

    await expect(page.getByText(/fora da cobertura do plano/i)).toBeVisible();
    await expect(page.locator("aside").getByRole("button", { name: "Confirmar com pagamento avulso" })).toBeVisible();

    await page.locator("aside").getByRole("button", { name: "Confirmar com pagamento avulso" }).click();

    await expect(page.getByText("Seu atendimento")).toBeVisible();
    expect(reservaBody).not.toBeNull();
    expect(reservaBody?.confirmar_avulso).toBe(true);
  });
});
