-- Remove serviços antigos/duplicados com segurança
-- Compatível com bancos que ainda não possuem colunas de serviço em agendamentos.
-- Execute no SQL Editor do Supabase

BEGIN;

DO $$
DECLARE
  has_servico_id boolean;
  has_servico_nome boolean;
  has_servico_duracao boolean;
  has_servico_preco boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamentos'
      AND column_name = 'servico_id'
  ) INTO has_servico_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamentos'
      AND column_name = 'servico_nome'
  ) INTO has_servico_nome;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamentos'
      AND column_name = 'servico_duracao_minutos'
  ) INTO has_servico_duracao;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamentos'
      AND column_name = 'servico_preco'
  ) INTO has_servico_preco;

  -- Se existir servico_id, limpamos a FK para permitir exclusão dos serviços antigos.
  -- Também preservamos dados históricos nas colunas existentes.
  IF has_servico_id THEN
    IF has_servico_nome AND has_servico_duracao AND has_servico_preco THEN
      WITH servicos_antigos AS (
        SELECT id, nome, duracao_minutos, preco
        FROM public.servicos
        WHERE codigo IN ('acabamento', 'corte', 'corte_barba')
      ),
      agendamentos_alvo AS (
        SELECT a.id, sa.nome, sa.duracao_minutos, sa.preco
        FROM public.agendamentos a
        JOIN servicos_antigos sa ON sa.id = a.servico_id
      )
      UPDATE public.agendamentos a
      SET
        servico_nome = COALESCE(NULLIF(a.servico_nome, ''), aa.nome),
        servico_duracao_minutos = COALESCE(a.servico_duracao_minutos, aa.duracao_minutos, 30),
        servico_preco = COALESCE(a.servico_preco, aa.preco, 0),
        servico_id = NULL
      FROM agendamentos_alvo aa
      WHERE aa.id = a.id;

    ELSIF has_servico_nome AND has_servico_duracao THEN
      WITH servicos_antigos AS (
        SELECT id, nome, duracao_minutos
        FROM public.servicos
        WHERE codigo IN ('acabamento', 'corte', 'corte_barba')
      ),
      agendamentos_alvo AS (
        SELECT a.id, sa.nome, sa.duracao_minutos
        FROM public.agendamentos a
        JOIN servicos_antigos sa ON sa.id = a.servico_id
      )
      UPDATE public.agendamentos a
      SET
        servico_nome = COALESCE(NULLIF(a.servico_nome, ''), aa.nome),
        servico_duracao_minutos = COALESCE(a.servico_duracao_minutos, aa.duracao_minutos, 30),
        servico_id = NULL
      FROM agendamentos_alvo aa
      WHERE aa.id = a.id;

    ELSIF has_servico_nome THEN
      WITH servicos_antigos AS (
        SELECT id, nome
        FROM public.servicos
        WHERE codigo IN ('acabamento', 'corte', 'corte_barba')
      ),
      agendamentos_alvo AS (
        SELECT a.id, sa.nome
        FROM public.agendamentos a
        JOIN servicos_antigos sa ON sa.id = a.servico_id
      )
      UPDATE public.agendamentos a
      SET
        servico_nome = COALESCE(NULLIF(a.servico_nome, ''), aa.nome),
        servico_id = NULL
      FROM agendamentos_alvo aa
      WHERE aa.id = a.id;

    ELSE
      -- Cenário mínimo: só remove referência da FK.
      UPDATE public.agendamentos
      SET servico_id = NULL
      WHERE servico_id IN (
        SELECT id
        FROM public.servicos
        WHERE codigo IN ('acabamento', 'corte', 'corte_barba')
      );
    END IF;
  END IF;
END $$;

-- Remove os serviços antigos
DELETE FROM public.servicos
WHERE codigo IN ('acabamento', 'corte', 'corte_barba');

COMMIT;

-- Conferência rápida:
-- SELECT codigo, nome, duracao_minutos, preco, ativo, ordem
-- FROM public.servicos
-- ORDER BY ordem, nome;
