BEGIN;

ALTER TABLE public.agendamento_itens
  ADD COLUMN IF NOT EXISTS creditos_corte INTEGER NOT NULL DEFAULT 0 CHECK (creditos_corte >= 0),
  ADD COLUMN IF NOT EXISTS creditos_barba INTEGER NOT NULL DEFAULT 0 CHECK (creditos_barba >= 0),
  ADD COLUMN IF NOT EXISTS creditos_sobrancelha INTEGER NOT NULL DEFAULT 0 CHECK (creditos_sobrancelha >= 0);

UPDATE public.agendamento_itens
SET
  creditos_corte = CASE
    WHEN servico_id IN ('corte-de-cabelo', 'cabelo-barba', 'corte-cabelo-sobrancelha', 'combo-cabelo-barba-sobrancelha') THEN 1
    WHEN servico_categoria = 'corte' THEN 1
    ELSE creditos_corte
  END,
  creditos_barba = CASE
    WHEN servico_id IN ('barba', 'cabelo-barba', 'combo-cabelo-barba-sobrancelha') THEN 1
    WHEN servico_categoria = 'barba' THEN 1
    ELSE creditos_barba
  END,
  creditos_sobrancelha = CASE
    WHEN servico_id IN ('corte-cabelo-sobrancelha', 'combo-cabelo-barba-sobrancelha') THEN 1
    WHEN servico_categoria = 'sobrancelha' THEN 1
    ELSE creditos_sobrancelha
  END;

UPDATE public.planos
SET ativo = false,
    updated_at = timezone('utc', now())
WHERE id NOT IN ('bronze-corte', 'bronze-barba', 'prata', 'ouro');

INSERT INTO public.planos (id, nome, descricao, preco, cortes_incluidos, barbas_incluidas, sobrancelhas_incluidas, ativo, ordem)
VALUES
  ('bronze-corte', 'Plano Bronze Corte', '4 cortes no ciclo mensal', 100, 4, 0, 0, true, 1),
  ('bronze-barba', 'Plano Bronze Barba', '4 barbas no ciclo mensal', 60, 0, 4, 0, true, 2),
  ('prata', 'Plano Prata', '4 cortes e 4 sobrancelhas no ciclo mensal', 110, 4, 0, 4, true, 3),
  ('ouro', 'Plano Ouro', '4 barbas, 4 cortes e 4 sobrancelhas por ciclo', 150, 4, 4, 4, true, 4)
ON CONFLICT (id) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco = EXCLUDED.preco,
  cortes_incluidos = EXCLUDED.cortes_incluidos,
  barbas_incluidas = EXCLUDED.barbas_incluidas,
  sobrancelhas_incluidas = EXCLUDED.sobrancelhas_incluidas,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = timezone('utc', now());

UPDATE public.agendamentos
SET valor_final = 0,
    updated_at = timezone('utc', now())
WHERE tipo_cobranca = 'plano'
  AND valor_final <> 0;

COMMIT;
