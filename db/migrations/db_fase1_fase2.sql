BEGIN;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS status_agendamento TEXT,
  ADD COLUMN IF NOT EXISTS status_atendimento TEXT,
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS origem_agendamento TEXT,
  ADD COLUMN IF NOT EXISTS valor_tabela NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acrescimo NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;

UPDATE public.agendamentos
SET
  status_agendamento = COALESCE(status_agendamento, CASE WHEN status = 'cancelado' THEN 'cancelado' ELSE 'agendado' END),
  status_atendimento = COALESCE(status_atendimento, 'pendente'),
  status_pagamento = COALESCE(status_pagamento, 'pendente'),
  origem_agendamento = COALESCE(origem_agendamento, 'site'),
  valor_tabela = COALESCE(valor_tabela, servico_preco, 0),
  desconto = COALESCE(desconto, 0),
  acrescimo = COALESCE(acrescimo, 0),
  valor_final = COALESCE(valor_final, GREATEST(0, COALESCE(servico_preco, 0) - COALESCE(desconto, 0) + COALESCE(acrescimo, 0)));

ALTER TABLE public.agendamentos
  ALTER COLUMN status_agendamento SET DEFAULT 'agendado',
  ALTER COLUMN status_atendimento SET DEFAULT 'pendente',
  ALTER COLUMN status_pagamento SET DEFAULT 'pendente',
  ALTER COLUMN origem_agendamento SET DEFAULT 'site',
  ALTER COLUMN valor_tabela SET DEFAULT 0,
  ALTER COLUMN desconto SET DEFAULT 0,
  ALTER COLUMN acrescimo SET DEFAULT 0,
  ALTER COLUMN valor_final SET DEFAULT 0;

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_status_agendamento_check,
  DROP CONSTRAINT IF EXISTS agendamentos_status_atendimento_check,
  DROP CONSTRAINT IF EXISTS agendamentos_status_pagamento_check,
  DROP CONSTRAINT IF EXISTS agendamentos_origem_agendamento_check,
  DROP CONSTRAINT IF EXISTS agendamentos_valor_tabela_check,
  DROP CONSTRAINT IF EXISTS agendamentos_desconto_check,
  DROP CONSTRAINT IF EXISTS agendamentos_acrescimo_check,
  DROP CONSTRAINT IF EXISTS agendamentos_valor_final_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_status_agendamento_check CHECK (status_agendamento IN ('agendado', 'confirmado', 'cancelado', 'no_show')),
  ADD CONSTRAINT agendamentos_status_atendimento_check CHECK (status_atendimento IN ('pendente', 'em_atendimento', 'concluido')),
  ADD CONSTRAINT agendamentos_status_pagamento_check CHECK (status_pagamento IN ('pendente', 'pago', 'estornado')),
  ADD CONSTRAINT agendamentos_origem_agendamento_check CHECK (origem_agendamento IN ('site', 'admin_manual', 'horario_customizado')),
  ADD CONSTRAINT agendamentos_valor_tabela_check CHECK (valor_tabela >= 0),
  ADD CONSTRAINT agendamentos_desconto_check CHECK (desconto >= 0),
  ADD CONSTRAINT agendamentos_acrescimo_check CHECK (acrescimo >= 0),
  ADD CONSTRAINT agendamentos_valor_final_check CHECK (valor_final >= 0);

ALTER TABLE public.horarios_customizados
  ADD COLUMN IF NOT EXISTS nome_cliente TEXT,
  ADD COLUMN IF NOT EXISTS celular_cliente TEXT;

ALTER TABLE public.bloqueios_agenda
  ADD COLUMN IF NOT EXISTS tipo_bloqueio TEXT;

UPDATE public.bloqueios_agenda
SET tipo_bloqueio = CASE
  WHEN dia_inteiro = true THEN 'dia_inteiro'
  ELSE COALESCE(tipo_bloqueio, 'horario')
END
WHERE tipo_bloqueio IS NULL;

ALTER TABLE public.bloqueios_agenda
  ALTER COLUMN tipo_bloqueio SET DEFAULT 'horario';

ALTER TABLE public.bloqueios_agenda
  DROP CONSTRAINT IF EXISTS bloqueios_agenda_tipo_bloqueio_check;

ALTER TABLE public.bloqueios_agenda
  ADD CONSTRAINT bloqueios_agenda_tipo_bloqueio_check CHECK (tipo_bloqueio IN ('horario', 'dia_inteiro', 'nao_aceitar_mais'));

CREATE INDEX IF NOT EXISTS idx_agendamentos_data_status_agendamento
  ON public.agendamentos(data, status_agendamento);

COMMIT;
