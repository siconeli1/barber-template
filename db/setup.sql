-- Gerado por scripts/build-setup-sql.mjs (npm run db:setup). Nao edite a mao:
-- altere db/migrations/ e gere de novo.
-- Uso: projeto Supabase NOVO -> SQL Editor -> cole este arquivo inteiro -> Run.

-- ===== 20260319_initial_multi_barbeiro.sql =====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.barbeiros (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'barbeiro' CHECK (cargo IN ('socio', 'barbeiro')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.servicos (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0),
  preco NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbeiro_id TEXT NOT NULL REFERENCES public.barbeiros(id) ON DELETE RESTRICT,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  nome_cliente TEXT NOT NULL,
  celular_cliente TEXT NOT NULL,
  servico_id TEXT REFERENCES public.servicos(id) ON DELETE SET NULL,
  servico_nome TEXT NOT NULL,
  servico_duracao_minutos INTEGER NOT NULL CHECK (servico_duracao_minutos > 0),
  servico_preco NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (servico_preco >= 0),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  status_agendamento TEXT NOT NULL DEFAULT 'agendado' CHECK (status_agendamento IN ('agendado', 'confirmado', 'cancelado', 'no_show')),
  status_atendimento TEXT NOT NULL DEFAULT 'pendente' CHECK (status_atendimento IN ('pendente', 'em_atendimento', 'concluido')),
  status_pagamento TEXT NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente', 'pago', 'estornado')),
  origem_agendamento TEXT NOT NULL DEFAULT 'site' CHECK (origem_agendamento IN ('site', 'admin_manual', 'horario_customizado')),
  valor_tabela NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_tabela >= 0),
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  acrescimo NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (acrescimo >= 0),
  valor_final NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_final >= 0),
  forma_pagamento TEXT,
  observacoes TEXT,
  concluido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (hora_fim > hora_inicio)
);

CREATE TABLE IF NOT EXISTS public.bloqueios_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbeiro_id TEXT NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  dia_inteiro BOOLEAN NOT NULL DEFAULT false,
  tipo_bloqueio TEXT NOT NULL DEFAULT 'horario' CHECK (tipo_bloqueio IN ('horario', 'dia_inteiro', 'nao_aceitar_mais')),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (
    tipo_bloqueio <> 'horario'
    OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)
  )
);

CREATE TABLE IF NOT EXISTS public.horarios_customizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbeiro_id TEXT NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  nome_cliente TEXT,
  celular_cliente TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_data
  ON public.agendamentos (barbeiro_id, data, hora_inicio);

CREATE INDEX IF NOT EXISTS idx_bloqueios_barbeiro_data
  ON public.bloqueios_agenda (barbeiro_id, data, hora_inicio);

CREATE INDEX IF NOT EXISTS idx_horarios_customizados_barbeiro_data
  ON public.horarios_customizados (barbeiro_id, data, hora_inicio);

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_sem_sobreposicao;

ALTER TABLE public.horarios_customizados
  DROP CONSTRAINT IF EXISTS horarios_customizados_sem_sobreposicao;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_sem_sobreposicao
  EXCLUDE USING gist (
    barbeiro_id WITH =,
    data WITH =,
    tsrange((data + hora_inicio)::timestamp, (data + hora_fim)::timestamp, '[)') WITH &&
  )
  WHERE (status_agendamento <> 'cancelado');

ALTER TABLE public.horarios_customizados
  ADD CONSTRAINT horarios_customizados_sem_sobreposicao
  EXCLUDE USING gist (
    barbeiro_id WITH =,
    data WITH =,
    tsrange((data + hora_inicio)::timestamp, (data + hora_fim)::timestamp, '[)') WITH &&
  );

INSERT INTO public.barbeiros (id, nome, slug, login, senha_hash, cargo, ativo, ordem, foto_url)
VALUES
  -- Hashes de bootstrap aleatorios evitam expor credenciais seed no repositorio.
  -- Ajuste os barbeiros conforme o barbershop.config.ts do cliente.
  ('barbeiro', 'Barbeiro', 'barbeiro', 'admin', md5(random()::text || clock_timestamp()::text || 'barbeiro'), 'socio', true, 1, null)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  slug = EXCLUDED.slug,
  login = EXCLUDED.login,
  cargo = EXCLUDED.cargo,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  foto_url = EXCLUDED.foto_url,
  updated_at = timezone('utc', now());

COMMIT;

-- ===== 20260323_google_auth_planos.sql =====
BEGIN;

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'outro'
  CHECK (categoria IN ('corte', 'barba', 'sobrancelha', 'combo', 'outro'));

UPDATE public.servicos
SET categoria = CASE
  WHEN codigo IN ('corte-de-cabelo', 'cabelo') THEN 'corte'
  WHEN codigo IN ('barba') THEN 'barba'
  WHEN codigo IN ('sobrancelha') THEN 'sobrancelha'
  WHEN codigo IN ('cabelo-barba', 'combo-cabelo-barba-sobrancelha', 'corte-cabelo-sobrancelha') THEN 'combo'
  ELSE 'outro'
END;

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  data_nascimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.clientes
  ALTER COLUMN data_nascimento DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.clientes_telefone_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  origem TEXT NOT NULL DEFAULT 'cliente'
    CHECK (origem IN ('cliente', 'admin', 'cadastro_inicial'))
);

CREATE TABLE IF NOT EXISTS public.planos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
  cortes_incluidos INTEGER NOT NULL DEFAULT 0 CHECK (cortes_incluidos >= 0),
  barbas_incluidas INTEGER NOT NULL DEFAULT 0 CHECK (barbas_incluidas >= 0),
  sobrancelhas_incluidas INTEGER NOT NULL DEFAULT 0 CHECK (sobrancelhas_incluidas >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  plano_id TEXT NOT NULL REFERENCES public.planos(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'cancelado', 'expirado')),
  tipo_renovacao TEXT NOT NULL DEFAULT 'manual'
    CHECK (tipo_renovacao IN ('manual', 'automatica')),
  inicio_ciclo DATE NOT NULL,
  fim_ciclo DATE NOT NULL,
  proxima_renovacao DATE NOT NULL,
  cortes_totais INTEGER NOT NULL DEFAULT 0 CHECK (cortes_totais >= 0),
  cortes_restantes INTEGER NOT NULL DEFAULT 0 CHECK (cortes_restantes >= 0),
  cortes_reservados INTEGER NOT NULL DEFAULT 0 CHECK (cortes_reservados >= 0),
  barbas_totais INTEGER NOT NULL DEFAULT 0 CHECK (barbas_totais >= 0),
  barbas_restantes INTEGER NOT NULL DEFAULT 0 CHECK (barbas_restantes >= 0),
  barbas_reservadas INTEGER NOT NULL DEFAULT 0 CHECK (barbas_reservadas >= 0),
  sobrancelhas_totais INTEGER NOT NULL DEFAULT 0 CHECK (sobrancelhas_totais >= 0),
  sobrancelhas_restantes INTEGER NOT NULL DEFAULT 0 CHECK (sobrancelhas_restantes >= 0),
  sobrancelhas_reservadas INTEGER NOT NULL DEFAULT 0 CHECK (sobrancelhas_reservadas >= 0),
  observacoes_internas TEXT,
  cancelado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (fim_ciclo >= inicio_ciclo),
  CHECK (proxima_renovacao >= inicio_ciclo)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assinaturas_cliente_ativa
  ON public.assinaturas (cliente_id)
  WHERE status = 'ativo';

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_cobranca TEXT NOT NULL DEFAULT 'avulso'
    CHECK (tipo_cobranca IN ('avulso', 'plano', 'misto')),
  ADD COLUMN IF NOT EXISTS assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelavel_ate TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.agendamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  servico_id TEXT REFERENCES public.servicos(id) ON DELETE SET NULL,
  servico_nome TEXT NOT NULL,
  servico_categoria TEXT NOT NULL
    CHECK (servico_categoria IN ('corte', 'barba', 'sobrancelha', 'combo', 'outro')),
  servico_duracao_minutos INTEGER NOT NULL CHECK (servico_duracao_minutos > 0),
  servico_preco NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (servico_preco >= 0),
  tipo_cobranca TEXT NOT NULL CHECK (tipo_cobranca IN ('plano', 'avulso')),
  status_credito TEXT NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (status_credito IN ('reservado', 'consumido', 'devolvido', 'nao_aplicavel')),
  creditos_corte INTEGER NOT NULL DEFAULT 0 CHECK (creditos_corte >= 0),
  creditos_barba INTEGER NOT NULL DEFAULT 0 CHECK (creditos_barba >= 0),
  creditos_sobrancelha INTEGER NOT NULL DEFAULT 0 CHECK (creditos_sobrancelha >= 0),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.assinatura_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  categoria_servico TEXT NOT NULL
    CHECK (categoria_servico IN ('corte', 'barba', 'sobrancelha', 'combo', 'outro')),
  tipo_movimentacao TEXT NOT NULL
    CHECK (tipo_movimentacao IN ('reserva_credito', 'consumo_credito', 'devolucao_credito', 'renovacao', 'troca_imediata', 'uso_manual')),
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  categoria_financeira TEXT NOT NULL
    CHECK (categoria_financeira IN ('receita_plano_mensal', 'receita_servico_avulso')),
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  competencia DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'registrado' CHECK (status IN ('registrado', 'estornado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON public.clientes (telefone);
CREATE INDEX IF NOT EXISTS idx_assinaturas_vencimento ON public.assinaturas (status, proxima_renovacao);
CREATE INDEX IF NOT EXISTS idx_financeiro_competencia ON public.financeiro_lancamentos (competencia, categoria_financeira);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_clientes') THEN
    CREATE TRIGGER set_timestamp_clientes BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_planos') THEN
    CREATE TRIGGER set_timestamp_planos BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_assinaturas') THEN
    CREATE TRIGGER set_timestamp_assinaturas BEFORE UPDATE ON public.assinaturas FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_financeiro') THEN
    CREATE TRIGGER set_timestamp_financeiro BEFORE UPDATE ON public.financeiro_lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_telefone_inicial_cliente()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.clientes_telefone_historico (cliente_id, telefone, origem)
  VALUES (NEW.id, NEW.telefone, 'cadastro_inicial');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.registrar_alteracao_telefone_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.telefone IS DISTINCT FROM OLD.telefone THEN
    INSERT INTO public.clientes_telefone_historico (cliente_id, telefone, origem)
    VALUES (NEW.id, NEW.telefone, 'cliente');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_insert_clientes_historico_telefone') THEN
    CREATE TRIGGER after_insert_clientes_historico_telefone AFTER INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.registrar_telefone_inicial_cliente();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_update_clientes_historico_telefone') THEN
    CREATE TRIGGER after_update_clientes_historico_telefone AFTER UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.registrar_alteracao_telefone_cliente();
  END IF;
END $$;

COMMIT;

-- ===== 20260324_assinaturas_alertas.sql =====
BEGIN;

ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS ultimo_alerta_vencimento_em DATE;

CREATE INDEX IF NOT EXISTS idx_assinaturas_alerta_vencimento
  ON public.assinaturas (status, proxima_renovacao, ultimo_alerta_vencimento_em);

COMMIT;

-- ===== 20260324_clientes_data_nascimento_opcional.sql =====
BEGIN;

ALTER TABLE public.clientes
  ALTER COLUMN data_nascimento DROP NOT NULL;

COMMIT;

-- ===== 20260326_admin_planos_financeiro.sql =====
BEGIN;

ALTER TABLE public.agendamento_itens
  ADD COLUMN IF NOT EXISTS creditos_corte INTEGER NOT NULL DEFAULT 0 CHECK (creditos_corte >= 0),
  ADD COLUMN IF NOT EXISTS creditos_barba INTEGER NOT NULL DEFAULT 0 CHECK (creditos_barba >= 0),
  ADD COLUMN IF NOT EXISTS creditos_sobrancelha INTEGER NOT NULL DEFAULT 0 CHECK (creditos_sobrancelha >= 0);

UPDATE public.agendamento_itens
SET
  creditos_corte = CASE WHEN servico_categoria IN ('corte', 'combo') THEN 1 ELSE creditos_corte END,
  creditos_barba = CASE WHEN servico_categoria = 'barba' THEN 1 ELSE creditos_barba END,
  creditos_sobrancelha = CASE WHEN servico_categoria = 'sobrancelha' THEN 1 ELSE creditos_sobrancelha END;

UPDATE public.agendamentos
SET valor_final = 0,
    updated_at = timezone('utc', now())
WHERE tipo_cobranca = 'plano'
  AND valor_final <> 0;

COMMIT;

-- ===== 20260327_admin_roles.sql =====
BEGIN;

ALTER TABLE public.barbeiros
  ADD COLUMN IF NOT EXISTS cargo TEXT NOT NULL DEFAULT 'barbeiro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'barbeiros_cargo_check'
      AND conrelid = 'public.barbeiros'::regclass
  ) THEN
    ALTER TABLE public.barbeiros
      ADD CONSTRAINT barbeiros_cargo_check
      CHECK (cargo IN ('socio', 'barbeiro'));
  END IF;
END $$;

-- Ajuste os ids conforme os socios do cliente (ver barbershop.config.ts).
UPDATE public.barbeiros
SET cargo = CASE
  WHEN id IN ('barbeiro') THEN 'socio'
  ELSE 'barbeiro'
END,
updated_at = timezone('utc', now());

COMMIT;

-- ===== 20260330_security_and_atomic_ops.sql =====
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_admin_login_attempts') THEN
    CREATE TRIGGER set_timestamp_admin_login_attempts
    BEFORE UPDATE ON public.admin_login_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_agendamento_atomic(
  p_agendamento JSONB,
  p_itens JSONB
)
RETURNS public.agendamentos
LANGUAGE plpgsql
AS $$
DECLARE
  v_agendamento public.agendamentos;
  v_item JSONB;
  v_assinatura public.assinaturas;
  v_cliente_id UUID := NULLIF(p_agendamento->>'cliente_id', '')::UUID;
  v_assinatura_id UUID;
  v_creditos_corte INTEGER;
  v_creditos_barba INTEGER;
  v_creditos_sobrancelha INTEGER;
BEGIN
  INSERT INTO public.agendamentos (
    barbeiro_id,
    cliente_id,
    auth_user_id,
    assinatura_id,
    data,
    hora_inicio,
    hora_fim,
    nome_cliente,
    celular_cliente,
    servico_id,
    servico_nome,
    servico_duracao_minutos,
    servico_preco,
    valor_tabela,
    desconto,
    acrescimo,
    valor_final,
    status,
    status_agendamento,
    status_atendimento,
    status_pagamento,
    origem_agendamento,
    tipo_cobranca,
    cancelavel_ate,
    observacoes
  )
  VALUES (
    p_agendamento->>'barbeiro_id',
    NULLIF(p_agendamento->>'cliente_id', '')::UUID,
    NULLIF(p_agendamento->>'auth_user_id', '')::UUID,
    NULLIF(p_agendamento->>'assinatura_id', '')::UUID,
    (p_agendamento->>'data')::DATE,
    (p_agendamento->>'hora_inicio')::TIME,
    (p_agendamento->>'hora_fim')::TIME,
    p_agendamento->>'nome_cliente',
    p_agendamento->>'celular_cliente',
    NULLIF(p_agendamento->>'servico_id', ''),
    p_agendamento->>'servico_nome',
    COALESCE((p_agendamento->>'servico_duracao_minutos')::INTEGER, 0),
    COALESCE((p_agendamento->>'servico_preco')::NUMERIC, 0),
    COALESCE((p_agendamento->>'valor_tabela')::NUMERIC, 0),
    COALESCE((p_agendamento->>'desconto')::NUMERIC, 0),
    COALESCE((p_agendamento->>'acrescimo')::NUMERIC, 0),
    COALESCE((p_agendamento->>'valor_final')::NUMERIC, 0),
    COALESCE(p_agendamento->>'status', 'ativo'),
    COALESCE(p_agendamento->>'status_agendamento', 'agendado'),
    COALESCE(p_agendamento->>'status_atendimento', 'pendente'),
    COALESCE(p_agendamento->>'status_pagamento', 'pendente'),
    COALESCE(p_agendamento->>'origem_agendamento', 'site'),
    COALESCE(p_agendamento->>'tipo_cobranca', 'avulso'),
    NULLIF(p_agendamento->>'cancelavel_ate', '')::TIMESTAMPTZ,
    NULLIF(p_agendamento->>'observacoes', '')
  )
  RETURNING * INTO v_agendamento;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_itens, '[]'::JSONB))
  LOOP
    INSERT INTO public.agendamento_itens (
      agendamento_id,
      assinatura_id,
      servico_id,
      servico_nome,
      servico_categoria,
      servico_duracao_minutos,
      servico_preco,
      tipo_cobranca,
      status_credito,
      creditos_corte,
      creditos_barba,
      creditos_sobrancelha,
      ordem
    )
    VALUES (
      v_agendamento.id,
      NULLIF(v_item->>'assinatura_id', '')::UUID,
      NULLIF(v_item->>'servico_id', ''),
      v_item->>'servico_nome',
      v_item->>'servico_categoria',
      COALESCE((v_item->>'servico_duracao_minutos')::INTEGER, 0),
      COALESCE((v_item->>'servico_preco')::NUMERIC, 0),
      v_item->>'tipo_cobranca',
      COALESCE(v_item->>'status_credito', 'nao_aplicavel'),
      COALESCE((v_item->>'creditos_corte')::INTEGER, 0),
      COALESCE((v_item->>'creditos_barba')::INTEGER, 0),
      COALESCE((v_item->>'creditos_sobrancelha')::INTEGER, 0),
      COALESCE((v_item->>'ordem')::INTEGER, 0)
    );

    v_assinatura_id := NULLIF(v_item->>'assinatura_id', '')::UUID;

    IF v_assinatura_id IS NULL OR COALESCE(v_item->>'tipo_cobranca', '') <> 'plano' THEN
      CONTINUE;
    END IF;

    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Cliente vinculado obrigatorio para reservar credito de plano.';
    END IF;

    SELECT *
    INTO v_assinatura
    FROM public.assinaturas
    WHERE id = v_assinatura_id
    FOR UPDATE;

    IF NOT FOUND OR v_assinatura.cliente_id <> v_cliente_id OR v_assinatura.status <> 'ativo' THEN
      RAISE EXCEPTION 'Assinatura ativa nao encontrada.';
    END IF;

    v_creditos_corte := COALESCE((v_item->>'creditos_corte')::INTEGER, 0);
    v_creditos_barba := COALESCE((v_item->>'creditos_barba')::INTEGER, 0);
    v_creditos_sobrancelha := COALESCE((v_item->>'creditos_sobrancelha')::INTEGER, 0);

    IF v_creditos_corte > 0 THEN
      IF COALESCE(v_assinatura.cortes_restantes, 0) < v_creditos_corte THEN
        RAISE EXCEPTION 'Saldo insuficiente no plano.';
      END IF;

      UPDATE public.assinaturas
      SET cortes_restantes = cortes_restantes - v_creditos_corte,
          cortes_reservados = cortes_reservados + v_creditos_corte
      WHERE id = v_assinatura_id;

      INSERT INTO public.assinatura_movimentacoes (
        assinatura_id,
        cliente_id,
        categoria_servico,
        tipo_movimentacao,
        quantidade,
        agendamento_id,
        observacao
      )
      VALUES (
        v_assinatura_id,
        v_cliente_id,
        'corte',
        'reserva_credito',
        v_creditos_corte,
        v_agendamento.id,
        'Reserva do servico ' || COALESCE(v_item->>'servico_nome', '')
      );
    END IF;

    IF v_creditos_barba > 0 THEN
      IF COALESCE(v_assinatura.barbas_restantes, 0) < v_creditos_barba THEN
        RAISE EXCEPTION 'Saldo insuficiente no plano.';
      END IF;

      UPDATE public.assinaturas
      SET barbas_restantes = barbas_restantes - v_creditos_barba,
          barbas_reservadas = barbas_reservadas + v_creditos_barba
      WHERE id = v_assinatura_id;

      INSERT INTO public.assinatura_movimentacoes (
        assinatura_id,
        cliente_id,
        categoria_servico,
        tipo_movimentacao,
        quantidade,
        agendamento_id,
        observacao
      )
      VALUES (
        v_assinatura_id,
        v_cliente_id,
        'barba',
        'reserva_credito',
        v_creditos_barba,
        v_agendamento.id,
        'Reserva do servico ' || COALESCE(v_item->>'servico_nome', '')
      );
    END IF;

    IF v_creditos_sobrancelha > 0 THEN
      IF COALESCE(v_assinatura.sobrancelhas_restantes, 0) < v_creditos_sobrancelha THEN
        RAISE EXCEPTION 'Saldo insuficiente no plano.';
      END IF;

      UPDATE public.assinaturas
      SET sobrancelhas_restantes = sobrancelhas_restantes - v_creditos_sobrancelha,
          sobrancelhas_reservadas = sobrancelhas_reservadas + v_creditos_sobrancelha
      WHERE id = v_assinatura_id;

      INSERT INTO public.assinatura_movimentacoes (
        assinatura_id,
        cliente_id,
        categoria_servico,
        tipo_movimentacao,
        quantidade,
        agendamento_id,
        observacao
      )
      VALUES (
        v_assinatura_id,
        v_cliente_id,
        'sobrancelha',
        'reserva_credito',
        v_creditos_sobrancelha,
        v_agendamento.id,
        'Reserva do servico ' || COALESCE(v_item->>'servico_nome', '')
      );
    END IF;
  END LOOP;

  RETURN v_agendamento;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_assinatura_with_receita_atomic(
  p_payload JSONB,
  p_plano_nome TEXT,
  p_valor NUMERIC,
  p_competencia DATE,
  p_observacao TEXT
)
RETURNS public.assinaturas
LANGUAGE plpgsql
AS $$
DECLARE
  v_assinatura public.assinaturas;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assinaturas
    WHERE cliente_id = (p_payload->>'cliente_id')::UUID
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Cliente ja possui um plano ativo.';
  END IF;

  INSERT INTO public.assinaturas (
    cliente_id,
    plano_id,
    status,
    tipo_renovacao,
    inicio_ciclo,
    fim_ciclo,
    proxima_renovacao,
    cortes_totais,
    cortes_restantes,
    cortes_reservados,
    barbas_totais,
    barbas_restantes,
    barbas_reservadas,
    sobrancelhas_totais,
    sobrancelhas_restantes,
    sobrancelhas_reservadas,
    observacoes_internas
  )
  VALUES (
    (p_payload->>'cliente_id')::UUID,
    p_payload->>'plano_id',
    COALESCE(p_payload->>'status', 'ativo'),
    COALESCE(p_payload->>'tipo_renovacao', 'manual'),
    (p_payload->>'inicio_ciclo')::DATE,
    (p_payload->>'fim_ciclo')::DATE,
    (p_payload->>'proxima_renovacao')::DATE,
    COALESCE((p_payload->>'cortes_totais')::INTEGER, 0),
    COALESCE((p_payload->>'cortes_restantes')::INTEGER, 0),
    COALESCE((p_payload->>'cortes_reservados')::INTEGER, 0),
    COALESCE((p_payload->>'barbas_totais')::INTEGER, 0),
    COALESCE((p_payload->>'barbas_restantes')::INTEGER, 0),
    COALESCE((p_payload->>'barbas_reservadas')::INTEGER, 0),
    COALESCE((p_payload->>'sobrancelhas_totais')::INTEGER, 0),
    COALESCE((p_payload->>'sobrancelhas_restantes')::INTEGER, 0),
    COALESCE((p_payload->>'sobrancelhas_reservadas')::INTEGER, 0),
    NULLIF(p_payload->>'observacoes_internas', '')
  )
  RETURNING * INTO v_assinatura;

  INSERT INTO public.assinatura_movimentacoes (
    assinatura_id,
    cliente_id,
    categoria_servico,
    tipo_movimentacao,
    quantidade,
    observacao
  )
  VALUES (
    v_assinatura.id,
    v_assinatura.cliente_id,
    'outro',
    'renovacao',
    1,
    p_observacao
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.financeiro_lancamentos
    WHERE assinatura_id = v_assinatura.id
      AND categoria_financeira = 'receita_plano_mensal'
      AND competencia = p_competencia
      AND descricao = 'Plano mensal: ' || p_plano_nome
  ) THEN
    INSERT INTO public.financeiro_lancamentos (
      cliente_id,
      assinatura_id,
      categoria_financeira,
      descricao,
      valor,
      competencia
    )
    VALUES (
      v_assinatura.cliente_id,
      v_assinatura.id,
      'receita_plano_mensal',
      'Plano mensal: ' || p_plano_nome,
      p_valor,
      p_competencia
    );
  END IF;

  RETURN v_assinatura;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_assinatura_with_receita_atomic(
  p_assinatura_id UUID,
  p_patch JSONB,
  p_plano_nome TEXT,
  p_valor NUMERIC,
  p_competencia DATE,
  p_observacao TEXT
)
RETURNS public.assinaturas
LANGUAGE plpgsql
AS $$
DECLARE
  v_assinatura public.assinaturas;
BEGIN
  SELECT *
  INTO v_assinatura
  FROM public.assinaturas
  WHERE id = p_assinatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura nao encontrada.';
  END IF;

  UPDATE public.assinaturas
  SET plano_id = COALESCE(p_patch->>'plano_id', v_assinatura.plano_id),
      status = COALESCE(p_patch->>'status', v_assinatura.status),
      inicio_ciclo = COALESCE((p_patch->>'inicio_ciclo')::DATE, v_assinatura.inicio_ciclo),
      fim_ciclo = COALESCE((p_patch->>'fim_ciclo')::DATE, v_assinatura.fim_ciclo),
      proxima_renovacao = COALESCE((p_patch->>'proxima_renovacao')::DATE, v_assinatura.proxima_renovacao),
      cortes_totais = COALESCE((p_patch->>'cortes_totais')::INTEGER, v_assinatura.cortes_totais),
      cortes_restantes = COALESCE((p_patch->>'cortes_restantes')::INTEGER, v_assinatura.cortes_restantes),
      cortes_reservados = COALESCE((p_patch->>'cortes_reservados')::INTEGER, v_assinatura.cortes_reservados),
      barbas_totais = COALESCE((p_patch->>'barbas_totais')::INTEGER, v_assinatura.barbas_totais),
      barbas_restantes = COALESCE((p_patch->>'barbas_restantes')::INTEGER, v_assinatura.barbas_restantes),
      barbas_reservadas = COALESCE((p_patch->>'barbas_reservadas')::INTEGER, v_assinatura.barbas_reservadas),
      sobrancelhas_totais = COALESCE((p_patch->>'sobrancelhas_totais')::INTEGER, v_assinatura.sobrancelhas_totais),
      sobrancelhas_restantes = COALESCE((p_patch->>'sobrancelhas_restantes')::INTEGER, v_assinatura.sobrancelhas_restantes),
      sobrancelhas_reservadas = COALESCE((p_patch->>'sobrancelhas_reservadas')::INTEGER, v_assinatura.sobrancelhas_reservadas),
      observacoes_internas = COALESCE(NULLIF(p_patch->>'observacoes_internas', ''), v_assinatura.observacoes_internas)
  WHERE id = p_assinatura_id
  RETURNING * INTO v_assinatura;

  INSERT INTO public.assinatura_movimentacoes (
    assinatura_id,
    cliente_id,
    categoria_servico,
    tipo_movimentacao,
    quantidade,
    observacao
  )
  VALUES (
    v_assinatura.id,
    v_assinatura.cliente_id,
    'outro',
    'renovacao',
    1,
    p_observacao
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.financeiro_lancamentos
    WHERE assinatura_id = v_assinatura.id
      AND categoria_financeira = 'receita_plano_mensal'
      AND competencia = p_competencia
      AND descricao = 'Plano mensal: ' || p_plano_nome
  ) THEN
    INSERT INTO public.financeiro_lancamentos (
      cliente_id,
      assinatura_id,
      categoria_financeira,
      descricao,
      valor,
      competencia
    )
    VALUES (
      v_assinatura.cliente_id,
      v_assinatura.id,
      'receita_plano_mensal',
      'Plano mensal: ' || p_plano_nome,
      p_valor,
      p_competencia
    );
  END IF;

  RETURN v_assinatura;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_agendamento_update_atomic(
  p_agendamento_id UUID,
  p_barbeiro_id TEXT,
  p_patch JSONB
)
RETURNS public.agendamentos
LANGUAGE plpgsql
AS $$
DECLARE
  v_agendamento public.agendamentos;
  v_item RECORD;
  v_assinatura public.assinaturas;
  v_tipo_credito TEXT;
  v_status_agendamento TEXT := NULLIF(p_patch->>'status_agendamento', '');
  v_status_atendimento TEXT := NULLIF(p_patch->>'status_atendimento', '');
  v_descricao TEXT;
BEGIN
  UPDATE public.agendamentos
  SET status = COALESCE(NULLIF(p_patch->>'status', ''), status),
      status_agendamento = COALESCE(v_status_agendamento, status_agendamento),
      status_atendimento = COALESCE(v_status_atendimento, status_atendimento),
      status_pagamento = COALESCE(NULLIF(p_patch->>'status_pagamento', ''), status_pagamento),
      desconto = COALESCE((p_patch->>'desconto')::NUMERIC, desconto),
      acrescimo = COALESCE((p_patch->>'acrescimo')::NUMERIC, acrescimo),
      valor_final = COALESCE((p_patch->>'valor_final')::NUMERIC, valor_final),
      forma_pagamento = CASE
        WHEN p_patch ? 'forma_pagamento' THEN NULLIF(p_patch->>'forma_pagamento', '')
        ELSE forma_pagamento
      END,
      observacoes = CASE
        WHEN p_patch ? 'observacoes' THEN NULLIF(p_patch->>'observacoes', '')
        ELSE observacoes
      END,
      concluido_em = COALESCE(NULLIF(p_patch->>'concluido_em', '')::TIMESTAMPTZ, concluido_em),
      cancelado_em = COALESCE(NULLIF(p_patch->>'cancelado_em', '')::TIMESTAMPTZ, cancelado_em)
  WHERE id = p_agendamento_id
    AND barbeiro_id = p_barbeiro_id
  RETURNING * INTO v_agendamento;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF v_status_agendamento = 'cancelado' THEN
    v_tipo_credito := 'devolucao_credito';
  ELSIF v_status_agendamento = 'no_show' OR v_status_atendimento = 'concluido' THEN
    v_tipo_credito := 'consumo_credito';
  ELSE
    v_tipo_credito := NULL;
  END IF;

  IF v_tipo_credito IS NOT NULL THEN
    FOR v_item IN
      SELECT *
      FROM public.agendamento_itens
      WHERE agendamento_id = p_agendamento_id
        AND status_credito = 'reservado'
    LOOP
      IF v_item.assinatura_id IS NOT NULL THEN
        SELECT *
        INTO v_assinatura
        FROM public.assinaturas
        WHERE id = v_item.assinatura_id
        FOR UPDATE;

        IF FOUND THEN
          IF COALESCE(v_item.creditos_corte, 0) > 0 THEN
            UPDATE public.assinaturas
            SET cortes_reservados = cortes_reservados - v_item.creditos_corte,
                cortes_restantes = CASE
                  WHEN v_tipo_credito = 'devolucao_credito' THEN cortes_restantes + v_item.creditos_corte
                  ELSE cortes_restantes
                END
            WHERE id = v_item.assinatura_id;

            INSERT INTO public.assinatura_movimentacoes (
              assinatura_id,
              cliente_id,
              categoria_servico,
              tipo_movimentacao,
              quantidade,
              agendamento_id
            )
            VALUES (
              v_item.assinatura_id,
              v_agendamento.cliente_id,
              'corte',
              v_tipo_credito,
              v_item.creditos_corte,
              p_agendamento_id
            );
          END IF;

          IF COALESCE(v_item.creditos_barba, 0) > 0 THEN
            UPDATE public.assinaturas
            SET barbas_reservadas = barbas_reservadas - v_item.creditos_barba,
                barbas_restantes = CASE
                  WHEN v_tipo_credito = 'devolucao_credito' THEN barbas_restantes + v_item.creditos_barba
                  ELSE barbas_restantes
                END
            WHERE id = v_item.assinatura_id;

            INSERT INTO public.assinatura_movimentacoes (
              assinatura_id,
              cliente_id,
              categoria_servico,
              tipo_movimentacao,
              quantidade,
              agendamento_id
            )
            VALUES (
              v_item.assinatura_id,
              v_agendamento.cliente_id,
              'barba',
              v_tipo_credito,
              v_item.creditos_barba,
              p_agendamento_id
            );
          END IF;

          IF COALESCE(v_item.creditos_sobrancelha, 0) > 0 THEN
            UPDATE public.assinaturas
            SET sobrancelhas_reservadas = sobrancelhas_reservadas - v_item.creditos_sobrancelha,
                sobrancelhas_restantes = CASE
                  WHEN v_tipo_credito = 'devolucao_credito' THEN sobrancelhas_restantes + v_item.creditos_sobrancelha
                  ELSE sobrancelhas_restantes
                END
            WHERE id = v_item.assinatura_id;

            INSERT INTO public.assinatura_movimentacoes (
              assinatura_id,
              cliente_id,
              categoria_servico,
              tipo_movimentacao,
              quantidade,
              agendamento_id
            )
            VALUES (
              v_item.assinatura_id,
              v_agendamento.cliente_id,
              'sobrancelha',
              v_tipo_credito,
              v_item.creditos_sobrancelha,
              p_agendamento_id
            );
          END IF;
        END IF;
      END IF;

      UPDATE public.agendamento_itens
      SET status_credito = CASE
        WHEN v_tipo_credito = 'consumo_credito' THEN 'consumido'
        ELSE 'devolvido'
      END
      WHERE id = v_item.id;
    END LOOP;
  END IF;

  IF v_status_atendimento = 'concluido' THEN
    FOR v_item IN
      SELECT servico_nome, servico_preco
      FROM public.agendamento_itens
      WHERE agendamento_id = p_agendamento_id
        AND tipo_cobranca = 'avulso'
    LOOP
      v_descricao := 'Servico avulso: ' || v_item.servico_nome;

      IF NOT EXISTS (
        SELECT 1
        FROM public.financeiro_lancamentos
        WHERE agendamento_id = p_agendamento_id
          AND categoria_financeira = 'receita_servico_avulso'
          AND descricao = v_descricao
      ) THEN
        INSERT INTO public.financeiro_lancamentos (
          cliente_id,
          agendamento_id,
          categoria_financeira,
          descricao,
          valor,
          competencia
        )
        VALUES (
          v_agendamento.cliente_id,
          p_agendamento_id,
          'receita_servico_avulso',
          v_descricao,
          COALESCE(v_item.servico_preco, 0),
          v_agendamento.data
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_agendamento;
END;
$$;

COMMIT;

-- ===== 20260410_remove_google_auth.sql =====
-- Migration: Remove Google Auth dependency
-- Remove obrigatoriedade do auth_user_id e adicionar UNIQUE no telefone

-- 1. Tornar auth_user_id opcional na tabela clientes
ALTER TABLE public.clientes
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- 2. Remover a constraint de FK para auth.users (se existir)
-- Isso permite clientes sem conta Google
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_auth_user_id_fkey;

-- 3. Adicionar constraint UNIQUE no telefone (identificador primario)
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_telefone_unique UNIQUE (telefone);

-- 4. Remover index unico em auth_user_id (nao e mais o identificador principal)
-- Num banco criado do zero o UNIQUE vira constraint (e nao so index), entao ela sai primeiro.
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_auth_user_id_key;
DROP INDEX IF EXISTS public.clientes_auth_user_id_key;

-- 5. Tornar auth_user_id opcional na tabela agendamentos
ALTER TABLE public.agendamentos
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- 6. Remover FK de agendamentos.auth_user_id para auth.users (se existir)
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_auth_user_id_fkey;

-- ===== 20261029_rls_e_origem_telegram.sql =====
BEGIN;

-- O app acessa o banco so pelo servidor, com a service_role (que ignora RLS).
-- Ligar RLS sem policies fecha as tabelas para a chave anon/authenticated da API publica do Supabase.
ALTER TABLE public.barbeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_customizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_telefone_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinatura_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- As RPCs atomicas gravam direto no banco: so o servidor (service_role) pode chama-las.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Agendamentos criados pelo agente do Telegram (n8n) ficam identificados.
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_origem_agendamento_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_origem_agendamento_check
  CHECK (origem_agendamento IN ('site', 'admin_manual', 'horario_customizado', 'telegram'));

COMMIT;

-- ===== 20261029_seed_siconeli.sql =====
BEGIN;

-- Catalogo da Siconeli Barbearia, espelhando configs/siconeli.ts.
INSERT INTO public.servicos (id, codigo, nome, duracao_minutos, preco, ativo, ordem, categoria)
VALUES
  ('corte-de-cabelo', 'corte-de-cabelo', 'Corte de cabelo', 30, 45, true, 1, 'corte'),
  ('barba', 'barba', 'Barba', 30, 35, true, 2, 'barba'),
  ('cabelo-barba', 'cabelo-barba', 'Cabelo + barba', 60, 75, true, 3, 'combo')
ON CONFLICT (id) DO UPDATE SET
  codigo = EXCLUDED.codigo,
  nome = EXCLUDED.nome,
  duracao_minutos = EXCLUDED.duracao_minutos,
  preco = EXCLUDED.preco,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  categoria = EXCLUDED.categoria,
  updated_at = timezone('utc', now());

INSERT INTO public.planos (id, nome, descricao, preco, cortes_incluidos, barbas_incluidas, sobrancelhas_incluidas, ativo, ordem)
VALUES
  ('premium', 'Plano Premium', '4 cortes e 4 barbas no ciclo mensal', 180, 4, 4, 0, true, 1),
  ('essencial', 'Plano Essencial', '4 cortes no ciclo mensal', 120, 4, 0, 0, true, 2)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco = EXCLUDED.preco,
  cortes_incluidos = EXCLUDED.cortes_incluidos,
  barbas_incluidas = EXCLUDED.barbas_incluidas,
  sobrancelhas_incluidas = EXCLUDED.sobrancelhas_incluidas,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = timezone('utc', now());

COMMIT;
