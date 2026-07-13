import Image from "next/image";
import Link from "next/link";
import { listarPlanosAtivos } from "@/lib/planos";
import { getWhatsAppLink } from "@/lib/whatsapp";
import { HomeReturningCustomer } from "@/app/_components/HomeReturningCustomer";
import { formatRotinaSemanal } from "@/lib/horarios-display";
import barbershop from "@/barbershop.config";

const ROTINA = formatRotinaSemanal(barbershop.horarios);
const REDES_SOCIAIS = [
  { label: "Instagram", url: barbershop.redesSociais.instagram },
  { label: "Facebook", url: barbershop.redesSociais.facebook },
].filter((rede): rede is { label: string; url: string } => Boolean(rede.url));

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildPlanoItens(plano: Awaited<ReturnType<typeof listarPlanosAtivos>>[number]) {
  const itens: string[] = [];

  if (Number(plano.cortes_incluidos) > 0) {
    itens.push(`${plano.cortes_incluidos} corte(s)`);
  }
  if (Number(plano.barbas_incluidas) > 0) {
    itens.push(`${plano.barbas_incluidas} barba(s)`);
  }
  if (Number(plano.sobrancelhas_incluidas) > 0) {
    itens.push(`${plano.sobrancelhas_incluidas} sobrancelha(s)`);
  }

  return itens.length > 0 ? itens : ["Cobertura personalizada"];
}

export default async function Home() {
  const planos = await listarPlanosAtivos();
  // Highlight the plan with the most inclusions as "popular"
  const planoDestaque = planos.reduce((best, p) =>
    (Number(p.cortes_incluidos) + Number(p.barbas_incluidas) + Number(p.sobrancelhas_incluidas)) >
    (Number(best.cortes_incluidos) + Number(best.barbas_incluidas) + Number(best.sobrancelhas_incluidas))
      ? p : best
  , planos[0]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-10">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
                <Image
                  src={barbershop.logo}
                  alt={`Logo ${barbershop.nome}`}
                  width={320}
                  height={320}
                  priority
                  className="h-auto w-[220px] sm:w-[250px]"
                />
              </div>

              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--accent-strong)]">{barbershop.nomeExibicao}</p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-3">
                <Link
                  href="/agendar"
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-4 text-base font-semibold text-black hover:bg-[var(--accent-strong)]"
                >
                  Agendar
                </Link>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/meus-agendamentos"
                    className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-6 py-4 text-base font-semibold text-white hover:bg-white/[0.08]"
                  >
                    Meus agendamentos
                  </Link>
                  <Link
                    href="/minha-conta"
                    className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-6 py-4 text-base font-semibold text-white hover:bg-white/[0.08]"
                  >
                    Minha conta
                  </Link>
                </div>
              </div>

              <div>
                <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.2))] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Rotina da barbearia</p>
                  <div className="mt-5 space-y-3">
                    {ROTINA.map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--foreground)]">
                        {item}
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <HomeReturningCustomer />

        <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-6 text-center sm:mb-8">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Planos mensais</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Assine pelo WhatsApp</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {planos.map((plano) => {
              const itens = buildPlanoItens(plano);
              const isDestaque = plano.id === planoDestaque?.id && planos.length > 1;
              const whatsappLink = getWhatsAppLink(
                barbershop.whatsapp,
                `Olá, gostaria de assinar o plano mensal ${plano.nome}.`
              );

              return (
                <article
                  key={plano.id}
                  className={`rounded-[30px] border p-5 sm:p-6 ${
                    isDestaque
                      ? "border-[var(--accent)]/40 bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.1),rgba(255,255,255,0.01))]"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm uppercase tracking-[0.18em] text-[var(--accent-strong)]">Plano mensal</p>
                        {isDestaque ? (
                          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
                            Mais completo
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold">{plano.nome}</h3>
                    </div>
                    <div className="whitespace-nowrap rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)]">
                      {formatarPreco(Number(plano.preco))}
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {itens.map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--foreground)]">
                        {item}
                      </div>
                    ))}
                  </div>

                  <a
                    href={whatsappLink ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
                  >
                    Quero esse plano
                  </a>
                </article>
              );
            })}
          </div>

          <div className="mt-6 w-full rounded-[26px] border border-white/10 bg-black/25 px-5 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Endereço</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)] sm:text-base">{barbershop.endereco}</p>
            {REDES_SOCIAIS.length > 0 ? (
              <div className="mt-3 flex items-center justify-center gap-3">
                {REDES_SOCIAIS.map((rede) => (
                  <a
                    key={rede.label}
                    href={rede.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08]"
                  >
                    {rede.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
