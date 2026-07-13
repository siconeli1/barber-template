-- Criar tabela bloqueios_agenda no Supabase
-- Execute este SQL no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.bloqueios_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora_inicio TIME NULL,
  hora_fim TIME NULL,
  dia_inteiro BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_agenda_data
  ON public.bloqueios_agenda(data);

ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bloqueios_agenda_select ON public.bloqueios_agenda;
CREATE POLICY bloqueios_agenda_select
  ON public.bloqueios_agenda
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS bloqueios_agenda_insert ON public.bloqueios_agenda;
CREATE POLICY bloqueios_agenda_insert
  ON public.bloqueios_agenda
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS bloqueios_agenda_delete ON public.bloqueios_agenda;
CREATE POLICY bloqueios_agenda_delete
  ON public.bloqueios_agenda
  FOR DELETE
  USING (true);
