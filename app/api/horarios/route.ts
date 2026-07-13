import { NextResponse } from "next/server";
import { getAvailableSlots, validateCustomerBookingDate } from "@/lib/agenda-booking";
import { encontrarServicoAtivo, encontrarServicosAtivosPorIds } from "@/lib/servicos";
import { findBarbeiroById } from "@/lib/barbeiros";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");
  const servicoId = searchParams.get("servico_id");
  const servicoCodigo = searchParams.get("servico_codigo");
  const servicoIdsRaw = searchParams.get("servico_ids");
  const duracaoCustomRaw = searchParams.get("duracao_minutos");
  const barbeiroIdParam = searchParams.get("barbeiro_id");
  const barbeiroId = barbeiroIdParam === "qualquer" ? null : barbeiroIdParam;

  if (!data) {
    return NextResponse.json({ erro: "Informe ?data=YYYY-MM-DD" }, { status: 400 });
  }

  const dateValidation = validateCustomerBookingDate(data);
  if (!dateValidation.ok) {
    return NextResponse.json({ erro: dateValidation.erro }, { status: 409 });
  }

  if (barbeiroId) {
    const barbeiro = await findBarbeiroById(barbeiroId);
    if (!barbeiro || !barbeiro.ativo) {
      return NextResponse.json({ erro: "Barbeiro nao encontrado ou inativo" }, { status: 404 });
    }
  }

  let duracaoTotal = 0;
  let servicos = [] as Awaited<ReturnType<typeof encontrarServicosAtivosPorIds>>;

  if (servicoIdsRaw) {
    servicos = await encontrarServicosAtivosPorIds(servicoIdsRaw.split(","));
    duracaoTotal = servicos.reduce((acc, servico) => acc + Number(servico.duracao_minutos), 0);
  } else if (duracaoCustomRaw) {
    duracaoTotal = Number(duracaoCustomRaw);
  } else {
    if (!servicoId && !servicoCodigo) {
      return NextResponse.json({ erro: "Informe o servico." }, { status: 400 });
    }

    const servico = await encontrarServicoAtivo({ id: servicoId, codigo: servicoCodigo });
    if (!servico) {
      return NextResponse.json({ erro: "Serviço não encontrado ou inativo." }, { status: 404 });
    }

    servicos = [servico];
    duracaoTotal = Number(servico.duracao_minutos);
  }

  if (!Number.isFinite(duracaoTotal) || duracaoTotal <= 0) {
    return NextResponse.json({ erro: "Duracao invalida." }, { status: 400 });
  }

  const disponibilidade = await getAvailableSlots({
    data,
    duracao: duracaoTotal,
    barbeiroId,
  });

  return NextResponse.json({
    data,
    duracao_total: duracaoTotal,
    servicos,
    horarios: disponibilidade.horarios,
    horarios_completos: disponibilidade.horarios_completos,
  });
}
