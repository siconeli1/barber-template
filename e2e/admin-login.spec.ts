import { expect, test } from "@playwright/test";

test.describe("Admin login", () => {
  test("mostra erro para credenciais invalidas", async ({ page }) => {
    await page.route("**/api/admin/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ erro: "Login ou senha invalidos." }),
      });
    });

    await page.goto("/admin/login");

    await page.getByPlaceholder("Login").fill("teste");
    await page.getByPlaceholder("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar no painel" }).click();

    await expect(page.getByText("Login ou senha invalidos.")).toBeVisible();
  });

  test("login sucesso tenta abrir /admin e respeita middleware de sessao", async ({ page }) => {
    await page.route("**/api/admin/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route("**/api/admin/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          barbeiro: {
            id: "barbeiro-1",
            nome: "Barbeiro 1",
            login: "admin",
            cargo: "socio",
          },
        }),
      });
    });

    await page.route("**/api/barbeiros", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          barbeiros: [
            { id: "barbeiro-1", nome: "Barbeiro 1" },
            { id: "barbeiro-2", nome: "Barbeiro 2" },
          ],
        }),
      });
    });

    await page.route("**/api/admin-agenda**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/admin/login");

    await page.getByPlaceholder("Login").fill("admin");
    await page.getByPlaceholder("Senha").fill("1234");
    await page.getByRole("button", { name: "Entrar no painel" }).click();

    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(page.getByText("Login ou senha invalidos.")).toHaveCount(0);
  });
});
