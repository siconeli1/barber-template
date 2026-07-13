-- Garante colunas de servico em agendamentos e faz backfill seguro
-- Execute no SQL Editor do Supabase

BEGIN;

-- 1) Estrutura minima para servicos no agendamento
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS servico_id UUID NULL,
  ADD COLUMN IF NOT EXISTS servico_nome TEXT,
  ADD COLUMN IF NOT EXISTS servico_duracao_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS servico_preco NUMERIC(10,2);

-- 2) Backfill a partir de servico_id quando houver referencia valida
UPDATE public.agendamentos a
SET
  servico_nome = COALESCE(a.servico_nome, s.nome),
  servico_duracao_minutos = COALESCE(a.servico_duracao_minutos, s.duracao_minutos),
  servico_preco = COALESCE(a.servico_preco, s.preco)
FROM public.servicos s
WHERE a.servico_id = s.id;

-- 3) Fallback seguro para ativos sem dados de servico
UPDATE public.agendamentos
SET servico_nome = COALESCE(servico_nome, 'Servico nao informado')
WHERE status = 'ativo' AND servico_nome IS NULL;

UPDATE public.agendamentos
SET servico_duracao_minutos = COALESCE(servico_duracao_minutos, 30)
WHERE status = 'ativo' AND servico_duracao_minutos IS NULL;

UPDATE public.agendamentos
SET servico_preco = COALESCE(servico_preco, 0)
WHERE status = 'ativo' AND servico_preco IS NULL;

-- 4) Constraint de duracao padrao
ALTER TABLE public.agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_servico_duracao_check;

ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_servico_duracao_check
CHECK (servico_duracao_minutos > 0);

-- 5) Constraint de preco
ALTER TABLE public.agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_servico_preco_check;

ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_servico_preco_check
CHECK (servico_preco >= 0);

-- 6) FK de servico_id (opcional para historico)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agendamentos_servico_id_fkey'
  ) THEN
    ALTER TABLE public.agendamentos
      ADD CONSTRAINT agendamentos_servico_id_fkey
      FOREIGN KEY (servico_id)
      REFERENCES public.servicos(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 7) Indices uteis
CREATE INDEX IF NOT EXISTS idx_agendamentos_servico_id
  ON public.agendamentos(servico_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data_status
  ON public.agendamentos(data, status);

COMMIT;

-- Conferencia rapida:
-- SELECT COUNT(*) AS ativos_sem_servico
-- FROM public.agendamentos
-- WHERE status = 'ativo'
--   AND (
--     servico_nome IS NULL
--     OR servico_duracao_minutos IS NULL
--     OR servico_preco IS NULL
--   );
