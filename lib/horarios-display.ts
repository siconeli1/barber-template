import type { Periodo } from "@/lib/barbershop-config-types";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatPeriodos(periodos: Periodo[]) {
  return periodos.map((periodo) => `${periodo.inicio} às ${periodo.fim}`).join(" e ");
}

/**
 * Gera as linhas de rotina exibidas na home a partir dos horarios do config,
 * agrupando dias consecutivos com o mesmo expediente.
 * Ex.: { 1..3: 09-19, 4: 09-20 } vira ["Segunda a quarta: 09:00 às 19:00", "Quinta: ..."].
 */
export function formatRotinaSemanal(horarios: Record<number, Periodo[]>) {
  const linhas: string[] = [];
  const dias = Object.keys(horarios)
    .map(Number)
    .sort((a, b) => a - b);

  let index = 0;
  while (index < dias.length) {
    const inicio = dias[index];
    const assinatura = formatPeriodos(horarios[inicio]);

    let fim = inicio;
    while (
      index + 1 < dias.length &&
      dias[index + 1] === fim + 1 &&
      formatPeriodos(horarios[dias[index + 1]]) === assinatura
    ) {
      index += 1;
      fim = dias[index];
    }

    const label =
      inicio === fim
        ? DIAS_SEMANA[inicio]
        : `${DIAS_SEMANA[inicio]} a ${DIAS_SEMANA[fim].toLowerCase()}`;

    linhas.push(`${label}: ${assinatura}`);
    index += 1;
  }

  return linhas;
}
