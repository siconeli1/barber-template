-- Padroniza status da tabela agendamentos para ativo/cancelado
-- Execute no SQL Editor do Supabase

-- 1) migra registros legados
UPDATE public.agendamentos
SET status = 'ativo'
WHERE status = 'agendado';

-- 2) remove constraint antiga, se houver
ALTER TABLE public.agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_status_check;

-- 3) aplica padrão único de status
ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_status_check
CHECK (status IN ('ativo', 'cancelado'));

-- 4) garantia de default consistente
ALTER TABLE public.agendamentos
ALTER COLUMN status SET DEFAULT 'ativo';
