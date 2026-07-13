-- Adicionar coluna tipo_bloqueio na tabela bloqueios_agenda
-- Execute este SQL no SQL Editor do Supabase

ALTER TABLE public.bloqueios_agenda
ADD COLUMN IF NOT EXISTS tipo_bloqueio TEXT NOT NULL DEFAULT 'horario'
CHECK (tipo_bloqueio IN ('horario', 'dia_inteiro', 'nao_aceitar_mais'));

-- Atualizar registros existentes para ter o tipo correto
UPDATE public.bloqueios_agenda
SET tipo_bloqueio = CASE
  WHEN dia_inteiro = true THEN 'dia_inteiro'
  ELSE 'horario'
END;

-- Criar índice para a nova coluna
CREATE INDEX IF NOT EXISTS idx_bloqueios_agenda_tipo
  ON public.bloqueios_agenda(tipo_bloqueio);