import { expect, test } from "@playwright/test";

test.describe("Meus agendamentos", () => {
  test("consulta por telefone e cancela agendamento ativo", async ({ page }) => {
    let cancelado = false;

    await page.route("**/api/client/profile**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            id: "cliente-e2e",
            nome: "Cliente teste",
            telefone: "17999999999",
          },
        }),
      });
    });

    await page.route("**/api/meus-agendamentos**", async (route) => {
      const agendamentos = cancelado
        ? []
        : [
            {
              id: "ag-1",
              data: "2099-04-10",
              hora_inicio: "10:00",
              hora_fim: "10:30",
              cancelavel_ate: "2099-04-10T08:00:00.000Z",
              servico_nome: "Corte de cabelo",
              valor_final: 40,
              status_agendamento: "agendado",
              status_atendimento: "pendente",
              barbeiros: { nome: "Cantelle" },
            },
          ];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile_exists: true,
          agendamentos,
        }),
      });
    });

    await page.route("**/api/cancelar", async (route) => {
      cancelado = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/meus-agendamentos");

    await page.getByPlaceholder("(17) 99999-9999").fill("(17) 99999-9999");
    await page.getByRole("button", { name: "Consultar" }).click();

    await expect(page.getByText("Corte de cabelo")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar agendamento" }).click();

    await expect(page.getByRole("heading", { name: "Cancelar agendamento" })).toBeVisible();
    await page.getByRole("button", { name: "Sim, cancelar" }).click();

    await expect(page.getByText("Nenhum agendamento encontrado")).toBeVisible();
  });
});
