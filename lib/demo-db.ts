/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Banco de dados de demonstracao: guarda tudo em data/demo-db.json e emula o
 * subconjunto da API do Supabase (PostgREST) que o app usa, incluindo as
 * funcoes atomicas (rpc) definidas em db/migrations/20260330_security_and_atomic_ops.sql.
 *
 * E usado quando SUPABASE_URL nao esta configurada (ver lib/demo-mode.ts).
 * Em ambientes com filesystem somente leitura (ex.: Vercel), os dados vivem
 * em memoria e resetam a cada cold start — suficiente para demos.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import barbershop from "@/barbershop.config";
import { DEMO_ADMIN_PASSWORD } from "@/lib/demo-mode";

type Row = Record<string, any>;
type Database = Record<string, Row[]>;

const DATA_FILE = path.join(process.cwd(), "data", "demo-db.json");

const TABLES = [
  "barbeiros",
  "servicos",
  "planos",
  "clientes",
  "clientes_telefone_historico",
  "agendamentos",
  "agendamento_itens",
  "bloqueios_agenda",
  "horarios_customizados",
  "assinaturas",
  "assinatura_movimentacoes",
  "financeiro_lancamentos",
  "admin_login_attempts",
] as const;

const PRIMARY_KEYS: Record<string, string> = {
  admin_login_attempts: "key",
};

const UNIQUE_COLUMNS: Record<string, string[]> = {
  clientes: ["telefone"],
};

// Equivalente aos DEFAULTs das colunas no Postgres que o app nao preenche.
const COLUMN_DEFAULTS: Record<string, Row> = {
  financeiro_lancamentos: { status: "registrado" },
};

// Relacionamentos usados nos selects embutidos, ex.: "barbeiros(nome)".
const EMBED_FOREIGN_KEYS: Record<string, string> = {
  barbeiros: "barbeiro_id",
  clientes: "cliente_id",
};

function seedBarbeiros(): Row[] {
  const senhaHash = createHash("sha256").update(DEMO_ADMIN_PASSWORD).digest("hex");
  return barbershop.barbeiros.map((barbeiro, index) => ({
    id: barbeiro.id,
    nome: barbeiro.nome,
    slug: barbeiro.id,
    login: barbeiro.login,
    senha_hash: senhaHash,
    cargo: barbeiro.cargo,
    ativo: true,
    ordem: index + 1,
    foto_url: null,
  }));
}

function seedServicos(): Row[] {
  return barbershop.servicos.map((servico, index) => ({
    id: servico.id,
    codigo: servico.id,
    nome: servico.nome,
    categoria: servico.categoria,
    duracao_minutos: servico.duracaoMinutos,
    preco: servico.preco,
    ordem: index + 1,
    ativo: true,
  }));
}

function seedPlanos(): Row[] {
  return barbershop.planos.map((plano, index) => ({
    id: plano.id,
    nome: plano.nome,
    descricao: plano.descricao,
    preco: plano.preco,
    cortes_incluidos: plano.cortes,
    barbas_incluidas: plano.barbas,
    sobrancelhas_incluidas: plano.sobrancelhas,
    ativo: true,
    ordem: index + 1,
  }));
}

function emptyDatabase(): Database {
  const db: Database = {};
  for (const table of TABLES) {
    db[table] = [];
  }
  db.barbeiros = seedBarbeiros();
  db.servicos = seedServicos();
  db.planos = seedPlanos();
  return db;
}

function loadDatabase(): Database {
  let db = emptyDatabase();

  try {
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    db = { ...db, ...parsed };
  } catch {
    // Sem arquivo ainda (ou ilegivel): comeca do seed.
  }

  for (const table of TABLES) {
    if (!Array.isArray(db[table])) {
      db[table] = [];
    }
  }

  if (db.barbeiros.length === 0) {
    db.barbeiros = seedBarbeiros();
  }
  if (db.servicos.length === 0) {
    db.servicos = seedServicos();
  }
  if (db.planos.length === 0) {
    db.planos = seedPlanos();
  }

  return db;
}

const globalCache = globalThis as typeof globalThis & { __barberDemoDb?: Database };

function getDatabase(): Database {
  if (!globalCache.__barberDemoDb) {
    globalCache.__barberDemoDb = loadDatabase();
  }
  return globalCache.__barberDemoDb;
}

function persistDatabase() {
  try {
    mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(getDatabase(), null, 2), "utf8");
  } catch {
    // Filesystem somente leitura: mantem apenas em memoria.
  }
}

function nowIso() {
  return new Date().toISOString();
}

function looseEquals(a: any, b: any) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (typeof a === typeof b) {
    return a === b;
  }
  return String(a) === String(b);
}

function compareValues(a: any, b: any) {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

type Filter = (row: Row) => boolean;
type Order = { column: string; ascending: boolean };

type QueryResult = { data: any; error: { message: string } | null };

function parseEmbeds(columns: string | undefined) {
  if (!columns) {
    return [] as Array<{ table: string; fields: string[] }>;
  }

  const embeds: Array<{ table: string; fields: string[] }> = [];
  const regex = /([a-z_]+)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(columns)) !== null) {
    embeds.push({
      table: match[1],
      fields: match[2]
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
    });
  }

  return embeds;
}

class DemoQueryBuilder implements PromiseLike<QueryResult> {
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private returning = false;
  private embeds: Array<{ table: string; fields: string[] }> = [];

  constructor(private table: string) {}

  select(columns?: string) {
    if (this.mode === "select") {
      this.embeds = parseEmbeds(columns);
    }
    this.returning = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    this.returning = false;
    return this;
  }

  upsert(payload: Row | Row[]) {
    this.mode = "upsert";
    this.payload = payload;
    this.returning = false;
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    this.returning = false;
    return this;
  }

  delete() {
    this.mode = "delete";
    this.returning = false;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => looseEquals(row[column], value));
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && !looseEquals(row[column], value));
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.some((value) => looseEquals(row[column], value)));
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && compareValues(row[column], value) >= 0);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && compareValues(row[column], value) <= 0);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && compareValues(row[column], value) > 0);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => row[column] !== null && row[column] !== undefined && compareValues(row[column], value) < 0);
    return this;
  }

  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === "is" && value === null) {
      this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private matches(row: Row) {
    return this.filters.every((filter) => filter(row));
  }

  private applyEmbeds(row: Row) {
    if (this.embeds.length === 0) {
      return row;
    }

    const db = getDatabase();
    const withEmbeds: Row = { ...row };

    for (const embed of this.embeds) {
      const foreignKey = EMBED_FOREIGN_KEYS[embed.table];
      const related = foreignKey
        ? (db[embed.table] ?? []).find((candidate) => looseEquals(candidate.id, row[foreignKey]))
        : null;

      if (!related) {
        withEmbeds[embed.table] = null;
        continue;
      }

      const projected: Row = {};
      for (const field of embed.fields.length > 0 ? embed.fields : Object.keys(related)) {
        projected[field] = related[field];
      }
      withEmbeds[embed.table] = projected;
    }

    return withEmbeds;
  }

  private finalize(rows: Row[]): QueryResult {
    let output = rows.map((row) => this.applyEmbeds(structuredClone(row)));

    for (const order of [...this.orders].reverse()) {
      output = [...output].sort((a, b) => {
        const av = a[order.column];
        const bv = b[order.column];
        if ((av ?? null) === null && (bv ?? null) === null) return 0;
        if ((av ?? null) === null) return order.ascending ? 1 : -1;
        if ((bv ?? null) === null) return order.ascending ? -1 : 1;
        const cmp = compareValues(av, bv);
        return order.ascending ? cmp : -cmp;
      });
    }

    if (this.limitCount !== null) {
      output = output.slice(0, this.limitCount);
    }

    if (this.singleMode === "single") {
      if (output.length !== 1) {
        return { data: null, error: { message: `Esperada exatamente 1 linha em ${this.table}, encontradas ${output.length}.` } };
      }
      return { data: output[0], error: null };
    }

    if (this.singleMode === "maybeSingle") {
      if (output.length > 1) {
        return { data: null, error: { message: `Esperada no maximo 1 linha em ${this.table}, encontradas ${output.length}.` } };
      }
      return { data: output[0] ?? null, error: null };
    }

    return { data: output, error: null };
  }

  private execute(): QueryResult {
    const db = getDatabase();
    const rows = db[this.table];

    if (!rows) {
      return { data: null, error: { message: `Tabela desconhecida: ${this.table}` } };
    }

    if (this.mode === "select") {
      return this.finalize(rows.filter((row) => this.matches(row)));
    }

    if (this.mode === "insert" || this.mode === "upsert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const primaryKey = PRIMARY_KEYS[this.table] ?? "id";
      const affected: Row[] = [];

      for (const item of incoming) {
        if (this.mode === "upsert") {
          const existing = rows.find((row) => looseEquals(row[primaryKey], (item as Row)[primaryKey]));
          if (existing) {
            Object.assign(existing, item, { updated_at: nowIso() });
            affected.push(existing);
            continue;
          }
        }

        for (const uniqueColumn of UNIQUE_COLUMNS[this.table] ?? []) {
          const value = (item as Row)[uniqueColumn];
          if (value !== undefined && rows.some((row) => looseEquals(row[uniqueColumn], value))) {
            return {
              data: null,
              error: { message: `duplicate key value violates unique constraint "${this.table}_${uniqueColumn}_unique"` },
            };
          }
        }

        const row: Row = {
          id: randomUUID(),
          created_at: nowIso(),
          updated_at: nowIso(),
          ...structuredClone(COLUMN_DEFAULTS[this.table] ?? {}),
          ...structuredClone(item),
        };
        rows.push(row);
        affected.push(row);
      }

      persistDatabase();
      return this.returning ? this.finalize(affected) : { data: null, error: null };
    }

    if (this.mode === "update") {
      const affected: Row[] = [];
      for (const row of rows) {
        if (this.matches(row)) {
          Object.assign(row, structuredClone(this.payload), { updated_at: nowIso() });
          affected.push(row);
        }
      }
      persistDatabase();
      return this.returning ? this.finalize(affected) : { data: null, error: null };
    }

    // delete
    const kept: Row[] = [];
    const removed: Row[] = [];
    for (const row of rows) {
      (this.matches(row) ? removed : kept).push(row);
    }
    db[this.table] = kept;
    persistDatabase();
    return this.returning ? this.finalize(removed) : { data: null, error: null };
  }
}

// ---------------------------------------------------------------------------
// Funcoes atomicas (equivalentes as do Postgres em JS, com rollback via snapshot)
// ---------------------------------------------------------------------------

function emptyToNull(value: any) {
  return value === undefined || value === null || value === "" ? null : value;
}

function toNumber(value: any, fallback = 0) {
  const parsed = Number(value);
  return value === undefined || value === null || value === "" || Number.isNaN(parsed) ? fallback : parsed;
}

const CATEGORIAS_CREDITO = [
  { categoria: "corte", creditos: "creditos_corte", restantes: "cortes_restantes", reservados: "cortes_reservados" },
  { categoria: "barba", creditos: "creditos_barba", restantes: "barbas_restantes", reservados: "barbas_reservadas" },
  {
    categoria: "sobrancelha",
    creditos: "creditos_sobrancelha",
    restantes: "sobrancelhas_restantes",
    reservados: "sobrancelhas_reservadas",
  },
] as const;

function registrarMovimentacao(db: Database, mov: Row) {
  db.assinatura_movimentacoes.push({ id: randomUUID(), created_at: nowIso(), ...mov });
}

function rpcCreateAgendamentoAtomic(db: Database, args: Row) {
  const p = args.p_agendamento ?? {};
  const itens: Row[] = args.p_itens ?? [];
  const clienteId = emptyToNull(p.cliente_id);

  const agendamento: Row = {
    id: randomUUID(),
    created_at: nowIso(),
    updated_at: nowIso(),
    barbeiro_id: p.barbeiro_id,
    cliente_id: clienteId,
    auth_user_id: emptyToNull(p.auth_user_id),
    assinatura_id: emptyToNull(p.assinatura_id),
    data: p.data,
    hora_inicio: p.hora_inicio,
    hora_fim: p.hora_fim,
    nome_cliente: p.nome_cliente,
    celular_cliente: p.celular_cliente,
    servico_id: emptyToNull(p.servico_id),
    servico_nome: p.servico_nome,
    servico_duracao_minutos: toNumber(p.servico_duracao_minutos),
    servico_preco: toNumber(p.servico_preco),
    valor_tabela: toNumber(p.valor_tabela),
    desconto: toNumber(p.desconto),
    acrescimo: toNumber(p.acrescimo),
    valor_final: toNumber(p.valor_final),
    status: p.status || "ativo",
    status_agendamento: p.status_agendamento || "agendado",
    status_atendimento: p.status_atendimento || "pendente",
    status_pagamento: p.status_pagamento || "pendente",
    origem_agendamento: p.origem_agendamento || "site",
    tipo_cobranca: p.tipo_cobranca || "avulso",
    cancelavel_ate: emptyToNull(p.cancelavel_ate),
    observacoes: emptyToNull(p.observacoes),
    forma_pagamento: null,
    concluido_em: null,
    cancelado_em: null,
  };

  db.agendamentos.push(agendamento);

  for (const item of itens) {
    db.agendamento_itens.push({
      id: randomUUID(),
      created_at: nowIso(),
      agendamento_id: agendamento.id,
      assinatura_id: emptyToNull(item.assinatura_id),
      servico_id: emptyToNull(item.servico_id),
      servico_nome: item.servico_nome,
      servico_categoria: item.servico_categoria,
      servico_duracao_minutos: toNumber(item.servico_duracao_minutos),
      servico_preco: toNumber(item.servico_preco),
      tipo_cobranca: item.tipo_cobranca,
      status_credito: item.status_credito || "nao_aplicavel",
      creditos_corte: toNumber(item.creditos_corte),
      creditos_barba: toNumber(item.creditos_barba),
      creditos_sobrancelha: toNumber(item.creditos_sobrancelha),
      ordem: toNumber(item.ordem),
    });

    const assinaturaId = emptyToNull(item.assinatura_id);
    if (!assinaturaId || item.tipo_cobranca !== "plano") {
      continue;
    }

    if (!clienteId) {
      throw new Error("Cliente vinculado obrigatorio para reservar credito de plano.");
    }

    const assinatura = db.assinaturas.find((row) => looseEquals(row.id, assinaturaId));
    if (!assinatura || !looseEquals(assinatura.cliente_id, clienteId) || assinatura.status !== "ativo") {
      throw new Error("Assinatura ativa nao encontrada.");
    }

    for (const cat of CATEGORIAS_CREDITO) {
      const quantidade = toNumber(item[cat.creditos]);
      if (quantidade <= 0) continue;

      if (toNumber(assinatura[cat.restantes]) < quantidade) {
        throw new Error("Saldo insuficiente no plano.");
      }

      assinatura[cat.restantes] = toNumber(assinatura[cat.restantes]) - quantidade;
      assinatura[cat.reservados] = toNumber(assinatura[cat.reservados]) + quantidade;

      registrarMovimentacao(db, {
        assinatura_id: assinaturaId,
        cliente_id: clienteId,
        categoria_servico: cat.categoria,
        tipo_movimentacao: "reserva_credito",
        quantidade,
        agendamento_id: agendamento.id,
        observacao: `Reserva do servico ${item.servico_nome ?? ""}`,
      });
    }
  }

  return agendamento;
}

function rpcApplyAgendamentoUpdateAtomic(db: Database, args: Row) {
  const patch: Row = args.p_patch ?? {};
  const agendamento = db.agendamentos.find(
    (row) => looseEquals(row.id, args.p_agendamento_id) && looseEquals(row.barbeiro_id, args.p_barbeiro_id)
  );

  if (!agendamento) {
    throw new Error("Agendamento nao encontrado.");
  }

  const statusAgendamento = emptyToNull(patch.status_agendamento);
  const statusAtendimento = emptyToNull(patch.status_atendimento);

  agendamento.status = emptyToNull(patch.status) ?? agendamento.status;
  agendamento.status_agendamento = statusAgendamento ?? agendamento.status_agendamento;
  agendamento.status_atendimento = statusAtendimento ?? agendamento.status_atendimento;
  agendamento.status_pagamento = emptyToNull(patch.status_pagamento) ?? agendamento.status_pagamento;
  agendamento.desconto = patch.desconto !== undefined && patch.desconto !== null ? toNumber(patch.desconto) : agendamento.desconto;
  agendamento.acrescimo = patch.acrescimo !== undefined && patch.acrescimo !== null ? toNumber(patch.acrescimo) : agendamento.acrescimo;
  agendamento.valor_final = patch.valor_final !== undefined && patch.valor_final !== null ? toNumber(patch.valor_final) : agendamento.valor_final;
  if ("forma_pagamento" in patch) {
    agendamento.forma_pagamento = emptyToNull(patch.forma_pagamento);
  }
  if ("observacoes" in patch) {
    agendamento.observacoes = emptyToNull(patch.observacoes);
  }
  agendamento.concluido_em = emptyToNull(patch.concluido_em) ?? agendamento.concluido_em;
  agendamento.cancelado_em = emptyToNull(patch.cancelado_em) ?? agendamento.cancelado_em;
  agendamento.updated_at = nowIso();

  let tipoCredito: "devolucao_credito" | "consumo_credito" | null = null;
  if (statusAgendamento === "cancelado") {
    tipoCredito = "devolucao_credito";
  } else if (statusAgendamento === "no_show" || statusAtendimento === "concluido") {
    tipoCredito = "consumo_credito";
  }

  if (tipoCredito) {
    const itensReservados = db.agendamento_itens.filter(
      (item) => looseEquals(item.agendamento_id, agendamento.id) && item.status_credito === "reservado"
    );

    for (const item of itensReservados) {
      if (item.assinatura_id) {
        const assinatura = db.assinaturas.find((row) => looseEquals(row.id, item.assinatura_id));

        if (assinatura) {
          for (const cat of CATEGORIAS_CREDITO) {
            const quantidade = toNumber(item[cat.creditos]);
            if (quantidade <= 0) continue;

            assinatura[cat.reservados] = toNumber(assinatura[cat.reservados]) - quantidade;
            if (tipoCredito === "devolucao_credito") {
              assinatura[cat.restantes] = toNumber(assinatura[cat.restantes]) + quantidade;
            }

            registrarMovimentacao(db, {
              assinatura_id: item.assinatura_id,
              cliente_id: agendamento.cliente_id,
              categoria_servico: cat.categoria,
              tipo_movimentacao: tipoCredito,
              quantidade,
              agendamento_id: agendamento.id,
            });
          }
        }
      }

      item.status_credito = tipoCredito === "consumo_credito" ? "consumido" : "devolvido";
    }
  }

  if (statusAtendimento === "concluido") {
    const itensAvulsos = db.agendamento_itens.filter(
      (item) => looseEquals(item.agendamento_id, agendamento.id) && item.tipo_cobranca === "avulso"
    );

    for (const item of itensAvulsos) {
      const descricao = `Servico avulso: ${item.servico_nome}`;
      const jaLancado = db.financeiro_lancamentos.some(
        (lancamento) =>
          looseEquals(lancamento.agendamento_id, agendamento.id) &&
          lancamento.categoria_financeira === "receita_servico_avulso" &&
          lancamento.descricao === descricao
      );

      if (!jaLancado) {
        db.financeiro_lancamentos.push({
          id: randomUUID(),
          created_at: nowIso(),
          cliente_id: agendamento.cliente_id,
          agendamento_id: agendamento.id,
          categoria_financeira: "receita_servico_avulso",
          descricao,
          valor: toNumber(item.servico_preco),
          competencia: agendamento.data,
          status: "registrado",
        });
      }
    }
  }

  return agendamento;
}

function registrarReceitaPlano(db: Database, assinatura: Row, planoNome: string, valor: number, competencia: string) {
  const descricao = `Plano mensal: ${planoNome}`;
  const jaLancado = db.financeiro_lancamentos.some(
    (lancamento) =>
      looseEquals(lancamento.assinatura_id, assinatura.id) &&
      lancamento.categoria_financeira === "receita_plano_mensal" &&
      looseEquals(lancamento.competencia, competencia) &&
      lancamento.descricao === descricao
  );

  if (!jaLancado) {
    db.financeiro_lancamentos.push({
      id: randomUUID(),
      created_at: nowIso(),
      cliente_id: assinatura.cliente_id,
      assinatura_id: assinatura.id,
      categoria_financeira: "receita_plano_mensal",
      descricao,
      valor,
      competencia,
      status: "registrado",
    });
  }
}

function rpcCreateAssinaturaWithReceitaAtomic(db: Database, args: Row) {
  const payload: Row = args.p_payload ?? {};

  const jaTemPlanoAtivo = db.assinaturas.some(
    (row) => looseEquals(row.cliente_id, payload.cliente_id) && row.status === "ativo"
  );
  if (jaTemPlanoAtivo) {
    throw new Error("Cliente ja possui um plano ativo.");
  }

  const assinatura: Row = {
    id: randomUUID(),
    created_at: nowIso(),
    updated_at: nowIso(),
    cliente_id: payload.cliente_id,
    plano_id: payload.plano_id,
    status: payload.status || "ativo",
    tipo_renovacao: payload.tipo_renovacao || "manual",
    inicio_ciclo: payload.inicio_ciclo,
    fim_ciclo: payload.fim_ciclo,
    proxima_renovacao: payload.proxima_renovacao,
    cortes_totais: toNumber(payload.cortes_totais),
    cortes_restantes: toNumber(payload.cortes_restantes),
    cortes_reservados: toNumber(payload.cortes_reservados),
    barbas_totais: toNumber(payload.barbas_totais),
    barbas_restantes: toNumber(payload.barbas_restantes),
    barbas_reservadas: toNumber(payload.barbas_reservadas),
    sobrancelhas_totais: toNumber(payload.sobrancelhas_totais),
    sobrancelhas_restantes: toNumber(payload.sobrancelhas_restantes),
    sobrancelhas_reservadas: toNumber(payload.sobrancelhas_reservadas),
    observacoes_internas: emptyToNull(payload.observacoes_internas),
    ultimo_alerta_vencimento_em: null,
  };

  db.assinaturas.push(assinatura);

  registrarMovimentacao(db, {
    assinatura_id: assinatura.id,
    cliente_id: assinatura.cliente_id,
    categoria_servico: "outro",
    tipo_movimentacao: "renovacao",
    quantidade: 1,
    observacao: args.p_observacao ?? null,
  });

  registrarReceitaPlano(db, assinatura, args.p_plano_nome, toNumber(args.p_valor), args.p_competencia);

  return assinatura;
}

function rpcRenewAssinaturaWithReceitaAtomic(db: Database, args: Row) {
  const patch: Row = args.p_patch ?? {};
  const assinatura = db.assinaturas.find((row) => looseEquals(row.id, args.p_assinatura_id));

  if (!assinatura) {
    throw new Error("Assinatura nao encontrada.");
  }

  assinatura.plano_id = patch.plano_id ?? assinatura.plano_id;
  assinatura.status = patch.status ?? assinatura.status;
  assinatura.inicio_ciclo = patch.inicio_ciclo ?? assinatura.inicio_ciclo;
  assinatura.fim_ciclo = patch.fim_ciclo ?? assinatura.fim_ciclo;
  assinatura.proxima_renovacao = patch.proxima_renovacao ?? assinatura.proxima_renovacao;
  for (const campo of [
    "cortes_totais",
    "cortes_restantes",
    "cortes_reservados",
    "barbas_totais",
    "barbas_restantes",
    "barbas_reservadas",
    "sobrancelhas_totais",
    "sobrancelhas_restantes",
    "sobrancelhas_reservadas",
  ]) {
    if (patch[campo] !== undefined && patch[campo] !== null) {
      assinatura[campo] = toNumber(patch[campo]);
    }
  }
  assinatura.observacoes_internas = emptyToNull(patch.observacoes_internas) ?? assinatura.observacoes_internas;
  assinatura.updated_at = nowIso();

  registrarMovimentacao(db, {
    assinatura_id: assinatura.id,
    cliente_id: assinatura.cliente_id,
    categoria_servico: "outro",
    tipo_movimentacao: "renovacao",
    quantidade: 1,
    observacao: args.p_observacao ?? null,
  });

  registrarReceitaPlano(db, assinatura, args.p_plano_nome, toNumber(args.p_valor), args.p_competencia);

  return assinatura;
}

const RPC_FUNCTIONS: Record<string, (db: Database, args: Row) => Row> = {
  create_agendamento_atomic: rpcCreateAgendamentoAtomic,
  apply_agendamento_update_atomic: rpcApplyAgendamentoUpdateAtomic,
  create_assinatura_with_receita_atomic: rpcCreateAssinaturaWithReceitaAtomic,
  renew_assinatura_with_receita_atomic: rpcRenewAssinaturaWithReceitaAtomic,
};

async function runRpc(name: string, args: Row): Promise<QueryResult> {
  const fn = RPC_FUNCTIONS[name];

  if (!fn) {
    return { data: null, error: { message: `Could not find the function public.${name} in the schema cache` } };
  }

  const db = getDatabase();
  const snapshot = structuredClone(db);

  try {
    const result = fn(db, args ?? {});
    persistDatabase();
    return { data: structuredClone(result), error: null };
  } catch (error) {
    // Restaura o estado anterior (equivalente ao rollback da transacao).
    for (const table of Object.keys(snapshot)) {
      db[table] = snapshot[table];
    }
    return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
  }
}

export function createDemoSupabaseClient() {
  return {
    from(table: string) {
      return new DemoQueryBuilder(table);
    },
    rpc(name: string, args?: Row) {
      return runRpc(name, args ?? {});
    },
  };
}
