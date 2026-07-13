-- Corrige a constraint de duracao dos servicos em public.agendamentos
-- Use este script quando o banco ainda estiver aceitando apenas duracoes antigas.
-- Execute no SQL Editor do Supabase.

BEGIN;

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_servico_duracao_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_servico_duracao_check
  CHECK (servico_duracao_minutos > 0);

COMMIT;

-- Conferencia opcional:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'agendamentos_servico_duracao_check';
