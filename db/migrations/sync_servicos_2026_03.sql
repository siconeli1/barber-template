-- Sincroniza o catalogo de servicos com a tabela public.servicos
-- Execute no SQL Editor do Supabase

BEGIN;

UPDATE public.servicos
SET ativo = false
WHERE codigo IN (
  'corte',
  'corte_cabelo',
  'cabelo_barba',
  'combo_cabelo_barba_sobrancelha',
  'corte_cabelo_sobrancelha',
  'acabamento'
);

INSERT INTO public.servicos (codigo, nome, duracao_minutos, preco, ativo, ordem)
VALUES
  ('cabelo', 'Cabelo', 40, 45, true, 1),
  ('barba', 'Barba', 30, 40, true, 2),
  ('corte_barba', 'Corte e barba', 60, 80, true, 3),
  ('combo_barba_corte_sobrancelha', 'Combo barba, corte e sobrancelha', 60, 95, true, 4),
  ('acabamento_pezinho', 'Acabamento pezinho', 10, 15, true, 5)
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  duracao_minutos = EXCLUDED.duracao_minutos,
  preco = EXCLUDED.preco,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem;

COMMIT;
