import { expect, test } from "@playwright/test";

test.describe("Home and public navigation", () => {
  test("abre a home e navega para rotas principais", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('a[href="/agendar"]').first()).toBeVisible();
    await expect(page.locator('a[href="/meus-agendamentos"]').first()).toBeVisible();
    await expect(page.locator('a[href="/minha-conta"]').first()).toBeVisible();

    await page.locator('a[href="/agendar"]').first().click();
    await expect(page).toHaveURL(/\/agendar$/);

    await page.goto("/");
    await page.locator('a[href="/meus-agendamentos"]').first().click();
    await expect(page).toHaveURL(/\/meus-agendamentos$/);

    await page.goto("/");
    await page.locator('a[href="/minha-conta"]').first().click();
    await expect(page).toHaveURL(/\/minha-conta$/);
  });
});

