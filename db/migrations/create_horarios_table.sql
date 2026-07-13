-- Criar tabela horarios_customizados no Supabase
-- Execute este SQL no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.horarios_customizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_horarios_customizados_data
  ON public.horarios_customizados(data);

ALTER TABLE public.horarios_customizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horarios_customizados_select ON public.horarios_customizados;
CREATE POLICY horarios_customizados_select
  ON public.horarios_customizados
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS horarios_customizados_insert ON public.horarios_customizados;
CREATE POLICY horarios_customizados_insert
  ON public.horarios_customizados
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS horarios_customizados_delete ON public.horarios_customizados;
CREATE POLICY horarios_customizados_delete
  ON public.horarios_customizados
  FOR DELETE
  USING (true);
