"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NoticeToast } from "@/app/_components/NoticeToast";
import { getTodayInputValue, isDateBeyondLimit, isDateInPast, formatarCelular } from "@/lib/format";
import { useCustomerSession } from "@/lib/use-customer-session";
import { useAutoDismissState } from "@/lib/use-auto-dismiss-state";
import type { Servico } from "@/lib/servicos";

type BarbeiroOption = {
  id: string;
  nome: string;
  slug: string;
};

type Slot = {
  hora_inicio: string;
  hora_fim: string;
  barbeiros_disponiveis: string[];
};

type AgendarClientProps = {
  initialServicos: Servico[];
  initialBarbeiros: BarbeiroOption[];
  initialErro?: string;
};

type Confirmacao = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  barbeiro_nome: string;
  servico: { id: string; nome: string; preco: number; duracao_minutos: number; tipo_cobranca?: string };
  nome_cliente: string;
  telefone: string;
};

type CoverageDecision = {
  status: "sem_plano" | "coberto_com_plano" | "saldo_esgotado" | "nao_coberto" | "combo_avulso";
  confirmar_como: "plano" | "avulso";
  servico_referencia: string | null;
  mensagem: string | null;
  warning_tone: "danger" | "warning" | null;
  requires_avulso_confirmation: boolean;
};

export default function AgendarClient({ initialServicos, initialBarbeiros, initialErro }: AgendarClientProps) {
  const { profile, sessionReady, signIn, signOut } = useCustomerSession();

  // Formulário de identificação
  const [nomeInput, setNomeInput] = useState("");
  const [telefoneInput, setTelefoneInput] = useState("");
  const [loadingIdentificacao, setLoadingIdentificacao] = useState(false);
  const [precisaNome, setPrecisaNome] = useState(false);

  // Agendamento
  const [servicoId, setServicoId] = useState("");
  const [barbeiroId, setBarbeiroId] = useState("qualquer");
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<Slot[]>([]);
  const [todosHorarios, setTodosHorarios] = useState<Slot[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState("");
  const [erro, setErro] = useAutoDismissState();
  const [msg, setMsg] = useAutoDismissState();

  useEffect(() => {
    if (initialErro) {
      setErro(initialErro);
    }
  }, [initialErro, setErro]);

  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [showAllHorarios, setShowAllHorarios] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [loadingCobertura, setLoadingCobertura] = useState(false);
  const [coverageDecision, setCoverageDecision] = useState<CoverageDecision | null>(null);
  const [showCompactStepper, setShowCompactStepper] = useState(false);
  const stepperSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirmacao) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [confirmacao]);

  const servicoSelecionado = useMemo(
    () => initialServicos.find((servico) => servico.id === servicoId) ?? null,
    [initialServicos, servicoId]
  );
  const slotSelecionado = todosHorarios.find((slot) => slot.hora_inicio === horarioSelecionado) ?? null;
  const barbeiroEscolhido =
    barbeiroId === "qualquer"
      ? null
      : initialBarbeiros.find((barbeiro) => barbeiro.id === barbeiroId) ?? null;

  const dayNumber = data ? new Date(`${data}T00:00:00`).getDay() : -1;
  const isSunday = dayNumber === 0;
  const pastDate = data ? isDateInPast(data) : false;
  const outOfRange = data ? isDateBeyondLimit(data, 30) : false;
  const isClosedDay = isSunday;

  const resumoSelecionado = Boolean(servicoSelecionado || data || horarioSelecionado);
  const resumoCobertura =
    slotSelecionado && barbeiroId === "qualquer"
      ? `${slotSelecionado.barbeiros_disponiveis.length} barbeiro(s) livre(s)`
      : barbeiroEscolhido?.nome ?? null;

  const fluxoAgendamento = useMemo(() => {
    const hasCadastro = Boolean(profile);
    const hasServico = Boolean(servicoSelecionado);
    const hasDia = Boolean(data);
    const hasBarbeiro = Boolean(barbeiroId);
    const hasHorario = Boolean(horarioSelecionado);

    return [
      {
        id: "cadastro",
        label: "Cadastro",
        complete: hasCadastro,
        current: !hasCadastro,
      },
      {
        id: "servico",
        label: "Serviço",
        complete: hasServico,
        current: hasCadastro && !hasServico,
      },
      {
        id: "dia",
        label: "Dia",
        complete: hasDia,
        current: hasCadastro && hasServico && !hasDia,
      },
      {
        id: "barbeiro",
        label: "Barbeiro",
        complete: hasDia && hasBarbeiro,
        current: false,
      },
      {
        id: "horario",
        label: "Horário",
        complete: hasHorario,
        current: hasCadastro && hasServico && hasDia && !hasHorario,
      },
    ];
  }, [barbeiroId, data, horarioSelecionado, profile, servicoSelecionado]);

  const currentStepIndex = useMemo(() => {
    const activeIndex = fluxoAgendamento.findIndex((etapa) => etapa.current);
    if (activeIndex >= 0) {
      return activeIndex;
    }

    const firstIncompleteIndex = fluxoAgendamento.findIndex((etapa) => !etapa.complete);
    if (firstIncompleteIndex >= 0) {
      return firstIncompleteIndex;
    }

    return fluxoAgendamento.length - 1;
  }, [fluxoAgendamento]);

  const completedSteps = useMemo(
    () => fluxoAgendamento.filter((etapa) => etapa.complete).length,
    [fluxoAgendamento]
  );

  const progressPercent = useMemo(
    () => Math.max(8, Math.min(100, (completedSteps / fluxoAgendamento.length) * 100)),
    [completedSteps, fluxoAgendamento.length]
  );

  const currentStep = fluxoAgendamento[currentStepIndex] ?? fluxoAgendamento[0];
  const nextStep = fluxoAgendamento[currentStepIndex + 1] ?? null;
  const remainingSteps = Math.max(0, fluxoAgendamento.length - (currentStepIndex + 1));

  useEffect(() => {
    if (confirmacao) {
      setShowCompactStepper(false);
      return;
    }

    const target = stepperSectionRef.current;
    if (!target) {
      return;
    }
    const headerBottomOffset = 116;

    const updateCompactStepper = () => {
      const sectionBottom = target.offsetTop + target.offsetHeight;
      const shouldShow = window.scrollY + headerBottomOffset >= sectionBottom;
      setShowCompactStepper(shouldShow);
    };

    updateCompactStepper();
    window.addEventListener("scroll", updateCompactStepper, { passive: true });
    window.addEventListener("resize", updateCompactStepper);

    return () => {
      window.removeEventListener("scroll", updateCompactStepper);
      window.removeEventListener("resize", updateCompactStepper);
    };
  }, [confirmacao]);

  useEffect(() => {
    const controller = new AbortController();

    async function buscarHorarios() {
      if (!data || !servicoSelecionado || pastDate || outOfRange || isClosedDay) {
        setLoadingHorarios(false);
        setHorarios([]);
        setTodosHorarios([]);
        setHorarioSelecionado("");
        return;
      }

      setLoadingHorarios(true);
      setErro("");

      try {
        const res = await fetch(
          `/api/horarios?data=${encodeURIComponent(data)}&servico_id=${encodeURIComponent(servicoSelecionado.id)}&barbeiro_id=${encodeURIComponent(barbeiroId)}`,
          { signal: controller.signal }
        );
        const json = await res.json();

        if (controller.signal.aborted) return;

        if (!res.ok) {
          setErro(json.erro || "Erro ao buscar horários.");
          setHorarios([]);
          setTodosHorarios([]);
          return;
        }

        const completos = (json.horarios_completos ?? json.horarios ?? []) as Slot[];
        setHorarios(completos.slice(0, 12));
        setTodosHorarios(completos);
        if (horarioSelecionado && !completos.some((slot) => slot.hora_inicio === horarioSelecionado)) {
          setHorarioSelecionado("");
        }
        setShowAllHorarios(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setErro(error instanceof Error ? error.message : "Erro ao carregar horários.");
        setHorarios([]);
        setTodosHorarios([]);
      } finally {
        if (!controller.signal.aborted) setLoadingHorarios(false);
      }
    }

    void buscarHorarios();
    return () => { controller.abort(); };
  }, [barbeiroId, data, horarioSelecionado, isClosedDay, outOfRange, pastDate, servicoSelecionado, setErro]);

  useEffect(() => {
    setHorarioSelecionado("");
  }, [barbeiroId, data]);

  // Verificar cobertura do plano
  useEffect(() => {
    const controller = new AbortController();

    async function carregarCobertura() {
      if (!profile || !servicoSelecionado) {
        setCoverageDecision(null);
        setLoadingCobertura(false);
        return;
      }

      setLoadingCobertura(true);

      try {
        const res = await fetch(
          `/api/reservar/cobertura?servico_id=${encodeURIComponent(servicoSelecionado.id)}&telefone=${encodeURIComponent(profile.telefone)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const json = await res.json();

        if (controller.signal.aborted) return;

        if (!res.ok) {
          setCoverageDecision(null);
          return;
        }

        setCoverageDecision((json.cobertura as CoverageDecision | null) ?? null);
      } catch {
        if (!controller.signal.aborted) setCoverageDecision(null);
      } finally {
        if (!controller.signal.aborted) setLoadingCobertura(false);
      }
    }

    void carregarCobertura();
    return () => { controller.abort(); };
  }, [profile, servicoSelecionado]);

  async function handleIdentificacao() {
    setErro("");
    setLoadingIdentificacao(true);
    setPrecisaNome(false);

    const tel = telefoneInput.replace(/\D/g, "");

    // Primeiro tenta buscar sem nome (cliente existente)
    const { error } = await signIn(tel, nomeInput || undefined);

    if (error) {
      // Se o erro indica que o cliente é novo e precisa de nome
      if (error.message.includes("nome") || error.message.includes("cadastro")) {
        setPrecisaNome(true);
        if (!nomeInput) {
          setErro("Este número não está cadastrado. Informe seu nome para criar o cadastro.");
          setLoadingIdentificacao(false);
          return;
        }
      }
      setErro(error.message);
    }

    setLoadingIdentificacao(false);
  }

  async function reservar(forceAvulso = false) {
    if (!servicoSelecionado || !data || !horarioSelecionado) {
      setErro("Selecione o serviço, a data e o horário antes de confirmar.");
      return;
    }

    if (!profile) {
      setErro("Informe seu nome e telefone antes de confirmar.");
      return;
    }

    setLoadingReserva(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: profile.nome,
          telefone: profile.telefone,
          data,
          hora_inicio: horarioSelecionado,
          servico_id: servicoSelecionado.id,
          barbeiro_id: barbeiroId,
          confirmar_avulso: forceAvulso,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.requires_avulso_confirmation) {
          setCoverageDecision((json.cobertura as CoverageDecision | null) ?? coverageDecision);
          setErro(json.cobertura?.mensagem || json.erro || "Seu plano não cobre este serviço com saldo disponível.");
          return;
        }
        setErro(json.erro || "Erro ao confirmar agendamento.");
        return;
      }

      const itemApi = (json.itens ?? []).find((item: { servico_id: string }) => item.servico_id === servicoSelecionado.id);

      setConfirmacao({
        data,
        hora_inicio: horarioSelecionado,
        hora_fim: slotSelecionado?.hora_fim ?? json.agendamento?.hora_fim ?? "-",
        barbeiro_nome: json.barbeiro?.nome ?? barbeiroEscolhido?.nome ?? "Barbeiro selecionado automaticamente",
        servico: {
          id: servicoSelecionado.id,
          nome: servicoSelecionado.nome,
          preco: Number(servicoSelecionado.preco),
          duracao_minutos: Number(servicoSelecionado.duracao_minutos),
          tipo_cobranca: json.agendamento?.tipo_cobranca ?? itemApi?.tipo_cobranca,
        },
        nome_cliente: profile.nome,
        telefone: profile.telefone,
      });

      setData("");
      setBarbeiroId("qualquer");
      setHorarioSelecionado("");
      setHorarios([]);
      setTodosHorarios([]);
      setCoverageDecision(null);
      setMsg("Agendamento confirmado com sucesso.");
    } catch {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setLoadingReserva(false);
    }
  }

  function handleNovoAgendamento() {
    setConfirmacao(null);
    setData("");
    setBarbeiroId("qualquer");
    setHorarioSelecionado("");
    setHorarios([]);
    setTodosHorarios([]);
    setCoverageDecision(null);
    setErro("");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatarPreco(valor: number) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarDataResumo(valor: string) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  const horariosVisiveis = showAllHorarios ? todosHorarios : horarios;
  const shouldConfirmAsAvulso = Boolean(coverageDecision?.requires_avulso_confirmation);
  const confirmButtonLabel = !profile
    ? "Confirmar agendamento"
    : coverageDecision?.status === "coberto_com_plano"
      ? "Confirmar com saldo do plano"
      : shouldConfirmAsAvulso
        ? "Confirmar com pagamento avulso"
        : "Confirmar agendamento";

  if (confirmacao) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            ← Voltar
          </Link>

          <section className="grid overflow-hidden border border-white/10 bg-white/[0.03] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-12">
              <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                Reserva confirmada
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">Seu atendimento está reservado.</h1>
              <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
                Para consultar ou cancelar, acesse a area de Meus agendamentos e informe seu celular.
              </p>

              <div className="mt-10">
                <div className="border border-white/10 bg-black/25 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Serviço</p>
                  <p className="mt-2 text-xl font-semibold">{confirmacao.servico.nome}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {confirmacao.servico.duracao_minutos} min - {formatarPreco(confirmacao.servico.preco)}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Barbeiro: <span className="font-semibold text-white">{confirmacao.barbeiro_nome}</span>
                  </p>
                  <p className="mt-2 text-sm text-[var(--accent-strong)]">
                    {confirmacao.servico.tipo_cobranca === "plano" ? "Coberto pelo plano" : "Serviço avulso"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Resumo</p>
              <div className="mt-6 space-y-4 text-sm">
                <ResumoItem label="Cliente" value={confirmacao.nome_cliente} />
                <ResumoItem label="Celular" value={confirmacao.telefone} />
                <ResumoItem label="Serviço" value={confirmacao.servico.nome} />
                <ResumoItem label="Data" value={formatarDataResumo(confirmacao.data)} />
                <ResumoItem label="Início" value={confirmacao.hora_inicio} />
                <ResumoItem label="Fim" value={confirmacao.hora_fim} />
                <ResumoItem label="Barbeiro" value={confirmacao.barbeiro_nome} />
                <ResumoItem
                  label="Valor"
                  value={confirmacao.servico.tipo_cobranca === "plano" ? "Pago com plano" : formatarPreco(confirmacao.servico.preco)}
                />
              </div>

              <div className="mt-10 grid gap-3">
                <Link
                  href="/meus-agendamentos"
                  className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
                >
                  Ver meus agendamentos
                </Link>
                <button
                  type="button"
                  onClick={handleNovoAgendamento}
                  className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                >
                  Fazer novo agendamento
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      {showCompactStepper ? (
        <div className="pointer-events-none fixed inset-x-0 top-[110px] z-40 sm:hidden">
          <div className="h-[3px] w-full bg-black/35">
            <div
              className="h-full bg-[var(--accent)] shadow-[0_0_12px_rgba(210,169,95,0.55)] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[var(--muted)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white">
            <span aria-hidden="true" className="text-base leading-none">←</span>
            <span>Voltar</span>
          </Link>
        </div>

        <section ref={stepperSectionRef} className="mb-8">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Fluxo do agendamento
              </p>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">
                {currentStepIndex + 1}/{fluxoAgendamento.length}
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 sm:hidden">
              <div className="min-w-0 rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                  Etapa atual
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{currentStep?.label}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {nextStep ? (
                  <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Próxima: {nextStep.label}
                  </span>
                ) : null}
                {remainingSteps > 1 ? (
                  <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    +{remainingSteps - 1}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 hidden grid-cols-5 gap-2 sm:grid">
              {fluxoAgendamento.map((etapa, index) => (
                <div
                  key={etapa.id}
                  className={`rounded-[18px] border px-3 py-3 text-center transition ${
                    etapa.complete
                      ? "border-[var(--accent)]/40 bg-[var(--accent)] text-black"
                      : index === currentStepIndex
                        ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-white"
                        : "border-white/10 bg-black/20 text-[var(--muted)]"
                  }`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold">{etapa.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {erro ? <NoticeToast tone="danger">{erro}</NoticeToast> : null}
        {msg ? <NoticeToast tone="success">{msg}</NoticeToast> : null}

        {!sessionReady && (
          <div className="space-y-4 mt-4">
            {[0,1,2].map((i) => (
              <div key={i} className="animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04] p-6 h-28" />
            ))}
          </div>
        )}

        {sessionReady && (
          <>
            {/* Etapa de cadastro */}
            {!profile && (
              <section className="mb-8 animate-fade-in-up rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.18))] p-5 sm:p-6">
                <div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">Cadastro</p>
                    <h2 className="mt-2 text-xl font-semibold">Informe seu celular para continuar</h2>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Se já agendou antes, seu cadastro é carregado automaticamente. Caso contrário, informe seu nome também.
                </p>
                <div className="mt-5 grid gap-3">
                  <input
                    type="tel"
                    value={telefoneInput}
                    onChange={(e) => setTelefoneInput(formatarCelular(e.target.value))}
                    placeholder="(17) 99999-9999"
                    maxLength={15}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/30"
                  />
                  {(precisaNome || nomeInput) && (
                    <input
                      type="text"
                      value={nomeInput}
                      onChange={(e) => setNomeInput(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/30"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleIdentificacao}
                    disabled={loadingIdentificacao || !telefoneInput}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
                  >
                    {loadingIdentificacao ? "Verificando..." : "Continuar"}
                  </button>
                </div>
              </section>
            )}

            {/* Cadastro reconhecido */}
            {profile && (
              <section className="mb-8 animate-fade-in-up flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">Cadastro ativo</p>
                  <p className="mt-2 truncate text-base font-semibold text-white">{profile.nome}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{profile.telefone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-white/10 hover:text-white"
                >
                  Trocar
                </button>
              </section>
            )}

            <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
              <section className="animate-fade-in-up space-y-8">
                <Card title="1. Escolha o serviço" description="Selecione o atendimento desejado.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {initialServicos.map((servico) => {
                      const ativo = servico.id === servicoId;
                      return (
                        <button
                          key={servico.id}
                          type="button"
                          onClick={() => setServicoId(servico.id)}
                          className={`rounded-[24px] border p-4 text-left ${
                            ativo
                              ? "border-[var(--accent)] bg-[linear-gradient(180deg,var(--accent),var(--accent-strong))] text-black shadow-[0_16px_30px_rgba(210,169,95,0.18)]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold">{servico.nome}</p>
                            <span className={`inline-flex min-w-[90px] items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${ativo ? "bg-black/10 text-black/75" : "border border-white/10 bg-black/20 text-[var(--accent-strong)]"}`}>
                              {servico.duracao_minutos} min
                            </span>
                          </div>
                          <p className={`mt-3 text-sm ${ativo ? "text-black/70" : "text-[var(--muted)]"}`}>
                            {formatarPreco(Number(servico.preco))}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card title="2. Data e profissional">
                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="agendamento-data" className="block text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                          Selecionar data
                        </label>
                        {data ? (
                          <button
                            type="button"
                            onClick={() => { setData(""); setHorarioSelecionado(""); }}
                            className="text-xs text-[var(--muted)] hover:text-white"
                          >
                            Limpar
                          </button>
                        ) : null}
                      </div>
                      <div className="relative overflow-hidden rounded-[22px] border border-white/12 bg-white/[0.03] transition focus-within:border-[var(--accent)] focus-within:bg-white/[0.05]">
                        {!data ? (
                          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base font-medium text-white/70">
                            dd/mm/aaaa
                          </span>
                        ) : null}
                        <input
                          id="agendamento-data"
                          type="date"
                          value={data}
                          data-empty={data ? "false" : "true"}
                          onChange={(event) => setData(event.target.value)}
                          min={getTodayInputValue()}
                          className="datetime-input agendamento-date-input w-full cursor-pointer border-0 bg-transparent px-4 py-3.5 text-base font-medium text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">Profissional</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Escolha um barbeiro específico ou deixe a agenda selecionar o primeiro disponível.</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                          {barbeiroId === "qualquer" ? "Escolha flexível" : "Escolha personalizada"}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <ProfissionalOptionCard
                          title="Qualquer um disponível"
                          subtitle="Mais flexível para encontrar horário rápido."
                          selected={barbeiroId === "qualquer"}
                          onClick={() => setBarbeiroId("qualquer")}
                        />
                        {initialBarbeiros.map((barbeiro) => (
                          <ProfissionalOptionCard
                            key={barbeiro.id}
                            title={barbeiro.nome}
                            subtitle="Selecionar este profissional na confirmação."
                            selected={barbeiroId === barbeiro.id}
                            onClick={() => setBarbeiroId(barbeiro.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                    {pastDate && "A data escolhida está no passado."}
                    {outOfRange && " A data está fora da janela de 30 dias."}
                    {isClosedDay && " A barbearia não atende aos domingos."}
                    {!pastDate && !outOfRange && !isClosedDay && " Segunda a quarta: 09:00 às 19:00. Quinta: 09:00 às 20:00. Sexta: 08:00 às 20:00. Sábado: 09:00 às 15:00."}
                  </p>
                </Card>

                <Card title="3. Horários disponíveis">
                  {loadingHorarios && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {[0,1,2,3,4,5,6,7].map((i) => (
                        <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 h-10" />
                      ))}
                    </div>
                  )}
                  {!loadingHorarios && todosHorarios.length === 0 && data && servicoSelecionado && !pastDate && !outOfRange && !isClosedDay && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-4 text-sm text-red-300">
                      Nenhum horário disponível para este serviço nesta data. Tente outra data.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {horariosVisiveis.map((slot) => (
                      <button
                        key={slot.hora_inicio}
                        type="button"
                        onClick={() => setHorarioSelecionado(slot.hora_inicio)}
                        className={`rounded-2xl border px-3 py-3 text-sm font-medium ${
                          horarioSelecionado === slot.hora_inicio
                            ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                            : "border-white/15 bg-white/[0.03] hover:border-white/35"
                        }`}
                      >
                        {slot.hora_inicio}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!showAllHorarios && todosHorarios.length > horarios.length && (
                      <button
                        type="button"
                        onClick={() => setShowAllHorarios(true)}
                        className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                      >
                        Ver mais horários
                      </button>
                    )}
                    {horarioSelecionado ? (
                      <button
                        type="button"
                        onClick={() => setHorarioSelecionado("")}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm text-[var(--muted)] hover:text-white"
                      >
                        Limpar seleção
                      </button>
                    ) : null}
                  </div>
                </Card>
              </section>

              <aside className="h-fit rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] p-5 sm:p-6 lg:sticky lg:top-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Resumo do agendamento</p>

                {!resumoSelecionado ? (
                  <div className="mt-5 space-y-3">
                    <ResumoHint titulo="Escolha o serviço" texto="Comece pelo atendimento que deseja fazer." />
                    <ResumoHint titulo="Defina a data" texto="O sistema libera apenas datas dentro da janela válida." />
                    <ResumoHint titulo="Selecione o horário" texto="Depois disso, a confirmação fica pronta no mesmo painel." />
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3">
                    {servicoSelecionado ? <ResumoPill label="Serviço" value={servicoSelecionado.nome} /> : null}
                    {servicoSelecionado ? <ResumoPill label="Duração" value={`${servicoSelecionado.duracao_minutos} min`} /> : null}
                    {servicoSelecionado ? <ResumoPill label="Valor" value={formatarPreco(Number(servicoSelecionado.preco))} /> : null}
                    {data ? <ResumoPill label="Data" value={formatarDataResumo(data)} /> : null}
                    {horarioSelecionado ? <ResumoPill label="Início" value={horarioSelecionado} /> : null}
                    {slotSelecionado?.hora_fim ? <ResumoPill label="Fim" value={slotSelecionado.hora_fim} /> : null}
                    <ResumoPill label="Barbeiro" value={barbeiroEscolhido?.nome ?? "Qualquer um disponível"} />
                    {resumoCobertura ? <ResumoPill label="Cobertura" value={resumoCobertura} /> : null}
                    {profile?.nome ? <ResumoPill label="Cliente" value={profile.nome} /> : null}
                  </div>
                )}

                {profile && servicoSelecionado && loadingCobertura ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[var(--muted)]">
                    Verificando cobertura do seu plano...
                  </div>
                ) : null}

                {profile && coverageDecision?.status === "coberto_com_plano" ? (
                  <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-sm text-emerald-100">
                    <p className="font-semibold">Este serviço será abatido do seu plano.</p>
                    <p className="mt-2 text-emerald-100/80">Ao confirmar, o agendamento será reservado usando o saldo disponível do seu plano.</p>
                  </div>
                ) : null}

                {profile && coverageDecision?.mensagem && coverageDecision.warning_tone === "danger" ? (
                  <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-100">
                    <p className="font-semibold">Pagamento avulso necessário</p>
                    <p className="mt-2 text-red-100/80">{coverageDecision.mensagem}</p>
                  </div>
                ) : null}

                {profile && coverageDecision?.mensagem && coverageDecision.warning_tone === "warning" ? (
                  <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
                    <p className="font-semibold">Serviço fora da cobertura do plano</p>
                    <p className="mt-2 text-amber-100/80">{coverageDecision.mensagem}</p>
                  </div>
                ) : null}

                {profile ? (
                  <button
                    type="button"
                    onClick={() => reservar(shouldConfirmAsAvulso)}
                    disabled={!servicoSelecionado || !data || !horarioSelecionado || loadingReserva}
                    className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingReserva ? "Confirmando..." : confirmButtonLabel}
                  </button>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.16))] p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfissionalOptionCard({ title, subtitle, selected, onClick }: { title: string; subtitle: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        selected
          ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(210,169,95,0.22),rgba(210,169,95,0.12))] shadow-[0_14px_28px_rgba(210,169,95,0.12)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
      }`}
    >
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
    </button>
  );
}

function ResumoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function ResumoHint({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <p className="font-semibold text-white">{titulo}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{texto}</p>
    </div>
  );
}
