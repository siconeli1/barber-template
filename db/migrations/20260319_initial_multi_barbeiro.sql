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

INSERT INTO public.servicos (id, codigo, nome, duracao_minutos, preco, ativo, ordem)
VALUES
  ('barba', 'barba', 'Barba', 30, 30, true, 1),
  ('acabamento', 'acabamento', 'Acabamento', 10, 15, true, 2),
  ('cabelo-barba', 'cabelo-barba', 'Cabelo + barba', 60, 70, true, 3),
  ('combo-cabelo-barba-sobrancelha', 'combo-cabelo-barba-sobrancelha', 'Combo cabelo + barba + sobrancelha', 60, 75, true, 4),
  ('corte-de-cabelo', 'corte-de-cabelo', 'Corte de cabelo', 30, 40, true, 5),
  ('corte-cabelo-sobrancelha', 'corte-cabelo-sobrancelha', 'Corte de cabelo + sobrancelha', 30, 50, true, 6),
  ('depilacao-nariz', 'depilacao-nariz', 'Depilacao de nariz', 10, 20, true, 7)
ON CONFLICT (id) DO UPDATE SET
  codigo = EXCLUDED.codigo,
  nome = EXCLUDED.nome,
  duracao_minutos = EXCLUDED.duracao_minutos,
  preco = EXCLUDED.preco,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = timezone('utc', now());

COMMIT;
