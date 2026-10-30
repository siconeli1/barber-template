BEGIN;

-- Catalogo da Siconeli Barbearia, espelhando configs/siconeli.ts.
INSERT INTO public.servicos (id, codigo, nome, duracao_minutos, preco, ativo, ordem, categoria)
VALUES
  ('corte-de-cabelo', 'corte-de-cabelo', 'Corte de cabelo', 30, 45, true, 1, 'corte'),
  ('barba', 'barba', 'Barba', 30, 35, true, 2, 'barba'),
  ('cabelo-barba', 'cabelo-barba', 'Cabelo + barba', 60, 75, true, 3, 'combo')
ON CONFLICT (id) DO UPDATE SET
  codigo = EXCLUDED.codigo,
  nome = EXCLUDED.nome,
  duracao_minutos = EXCLUDED.duracao_minutos,
  preco = EXCLUDED.preco,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  categoria = EXCLUDED.categoria,
  updated_at = timezone('utc', now());

INSERT INTO public.planos (id, nome, descricao, preco, cortes_incluidos, barbas_incluidas, sobrancelhas_incluidas, ativo, ordem)
VALUES
  ('premium', 'Plano Premium', '4 cortes e 4 barbas no ciclo mensal', 180, 4, 4, 0, true, 1),
  ('essencial', 'Plano Essencial', '4 cortes no ciclo mensal', 120, 4, 0, 0, true, 2)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco = EXCLUDED.preco,
  cortes_incluidos = EXCLUDED.cortes_incluidos,
  barbas_incluidas = EXCLUDED.barbas_incluidas,
  sobrancelhas_incluidas = EXCLUDED.sobrancelhas_incluidas,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = timezone('utc', now());

COMMIT;
