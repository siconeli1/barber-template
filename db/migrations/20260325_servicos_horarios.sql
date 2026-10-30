BEGIN;

UPDATE public.servicos
SET ativo = false,
    updated_at = timezone('utc', now())
WHERE id NOT IN (
  'barba',
  'acabamento',
  'cabelo-barba',
  'combo-cabelo-barba-sobrancelha',
  'corte-de-cabelo',
  'corte-cabelo-sobrancelha',
  'depilacao-nariz'
);

INSERT INTO public.servicos (id, codigo, nome, duracao_minutos, preco, ativo, ordem, categoria)
VALUES
  ('barba', 'barba', 'Barba', 30, 30, true, 1, 'barba'),
  ('acabamento', 'acabamento', 'Acabamento', 10, 15, true, 2, 'outro'),
  ('cabelo-barba', 'cabelo-barba', 'Cabelo + barba', 60, 70, true, 3, 'combo'),
  ('combo-cabelo-barba-sobrancelha', 'combo-cabelo-barba-sobrancelha', 'Combo cabelo + barba + sobrancelha', 60, 75, true, 4, 'combo'),
  ('corte-de-cabelo', 'corte-de-cabelo', 'Corte de cabelo', 30, 40, true, 5, 'corte'),
  ('corte-cabelo-sobrancelha', 'corte-cabelo-sobrancelha', 'Corte de cabelo + sobrancelha', 30, 50, true, 6, 'combo'),
  ('depilacao-nariz', 'depilacao-nariz', 'Depilacao de nariz', 10, 20, true, 7, 'outro')
ON CONFLICT (id) DO UPDATE
SET
  codigo = EXCLUDED.codigo,
  nome = EXCLUDED.nome,
  duracao_minutos = EXCLUDED.duracao_minutos,
  preco = EXCLUDED.preco,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  categoria = EXCLUDED.categoria,
  updated_at = timezone('utc', now());

COMMIT;
