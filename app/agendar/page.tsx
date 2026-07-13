import AgendarClient from "./AgendarClient";
import { listActiveBarbeiros } from "@/lib/barbeiros";
import { listarServicosAtivos, type Servico } from "@/lib/servicos";

export default async function AgendarPage() {
  let servicos: Servico[] = [];
  let barbeiros: Array<{ id: string; nome: string; slug: string }> = [];
  let initialErro: string | undefined;

  try {
    const [servicosCarregados, barbeirosCarregados] = await Promise.all([
      listarServicosAtivos(),
      listActiveBarbeiros(),
    ]);

    servicos = servicosCarregados;
    barbeiros = barbeirosCarregados.map((barbeiro) => ({
      id: barbeiro.id,
      nome: barbeiro.nome,
      slug: barbeiro.slug,
    }));
  } catch {
    initialErro = "Erro ao carregar dados iniciais";
  }

  return (
    <AgendarClient
      initialServicos={servicos}
      initialBarbeiros={barbeiros}
      initialErro={initialErro}
    />
  );
}
