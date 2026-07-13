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

INSERT INTO public.servicos (id, codigo, nome, duracao_minutos, preco, ativo, ordem, categoria)
VALUES
  ('barba', 'barba', 'Barba', 30, 30, true, 1, 'barba'),
  ('acabamento', 'acabamento', 'Acabamento', 10, 15, true, 2, 'outro'),
  ('cabelo-barba', 'cabelo-barba', 'Cabelo + barba', 60, 70, true, 3, 'combo'),
  ('combo-cabelo-barba-sobrancelha', 'combo-cabelo-barba-sobrancelha', 'Combo cabelo + barba + sobrancelha', 60, 75, true, 4, 'combo'),
  ('corte-de-cabelo', 'corte-de-cabelo', 'Corte de cabelo', 30, 40, true, 5, 'corte'),
  ('corte-cabelo-sobrancelha', 'corte-cabelo-sobrancelha', 'Corte de cabelo + sobrancelha', 30, 50, true, 6, 'combo'),
  ('depilacao-nariz', 'depilacao-nariz', 'Depilacao de nariz', 10, 20, true, 7, 'outro')
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
  ('bronze-corte', 'Plano Bronze Corte', '4 cortes no ciclo mensal', 100, 4, 0, 0, true, 1),
  ('bronze-barba', 'Plano Bronze Barba', '4 barbas no ciclo mensal', 60, 0, 4, 0, true, 2),
  ('prata', 'Plano Prata', '4 cortes e 4 sobrancelhas no ciclo mensal', 110, 4, 0, 4, true, 3),
  ('ouro', 'Plano Ouro', '4 barbas, 4 cortes e 4 sobrancelhas por ciclo', 150, 4, 4, 4, true, 4)
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
