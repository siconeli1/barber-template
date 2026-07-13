BEGIN;

ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS ultimo_alerta_vencimento_em DATE;

CREATE INDEX IF NOT EXISTS idx_assinaturas_alerta_vencimento
  ON public.assinaturas (status, proxima_renovacao, ultimo_alerta_vencimento_em);

COMMIT;
