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
