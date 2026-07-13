import type { Page, Route } from "@playwright/test";

export type CoverageDecision = {
  status: "sem_plano" | "coberto_com_plano" | "saldo_esgotado" | "nao_coberto" | "combo_avulso";
  confirmar_como: "plano" | "avulso";
  servico_referencia: string | null;
  mensagem: string | null;
  warning_tone: "danger" | "warning" | null;
  requires_avulso_confirmation: boolean;
};

type BookingMocksOptions = {
  coverage?: CoverageDecision;
  onReserveRequest?: (body: Record<string, unknown>) => void;
};

const DEFAULT_COVERAGE: CoverageDecision = {
  status: "sem_plano",
  confirmar_como: "avulso",
  servico_referencia: null,
  mensagem: null,
  warning_tone: null,
  requires_avulso_confirmation: false,
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function formatLocalDateAsIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNextBusinessDayIso() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);

    if (candidate.getDay() !== 0) {
      return formatLocalDateAsIso(candidate);
    }
  }

  return formatLocalDateAsIso(now);
}

export async function setupBookingMocks(page: Page, options: BookingMocksOptions = {}) {
  const coverage = options.coverage ?? DEFAULT_COVERAGE;

  await page.route("**/api/client/profile**", async (route) => {
    const method = route.request().method();
    const payload = method === "POST" || method === "PATCH"
      ? (route.request().postDataJSON() as Record<string, unknown>)
      : {};

    const telefoneRaw = String(
      payload.telefone ??
      payload.telefone_novo ??
      new URL(route.request().url()).searchParams.get("telefone") ??
      ""
    );
    const telefone = telefoneRaw.replace(/\D/g, "");

    if (!telefone) {
      await fulfillJson(route, { erro: "Informe o telefone." }, 400);
      return;
    }

    const nome = String(payload.nome ?? "Cliente teste");

    await fulfillJson(route, {
      profile: {
        id: "cliente-e2e",
        nome,
        telefone,
      },
    });
  });

  await page.route("**/api/horarios**", async (route) => {
    await fulfillJson(route, {
      horarios_completos: [
        { hora_inicio: "09:00", hora_fim: "09:30", barbeiros_disponiveis: ["barbeiro-1", "barbeiro-2"] },
        { hora_inicio: "09:30", hora_fim: "10:00", barbeiros_disponiveis: ["barbeiro-1"] },
      ],
      horarios: ["09:00", "09:30"],
    });
  });

  await page.route("**/api/reservar/cobertura**", async (route) => {
    await fulfillJson(route, { cobertura: coverage });
  });

  await page.route("**/api/reservar", async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    options.onReserveRequest?.(payload);

    const tipoCobranca = payload.confirmar_avulso ? "avulso" : coverage.confirmar_como === "plano" ? "plano" : "avulso";
    const servicoId = String(payload.servico_id ?? "servico-e2e");

    await fulfillJson(route, {
      ok: true,
      agendamento: {
        id: "agendamento-e2e",
        hora_fim: "09:30",
        tipo_cobranca: tipoCobranca,
      },
      barbeiro: {
        id: "barbeiro-1",
        nome: "Barbeiro 1",
        slug: "barbeiro-1",
      },
      itens: [
        {
          servico_id: servicoId,
          tipo_cobranca: tipoCobranca,
        },
      ],
    });
  });
}
