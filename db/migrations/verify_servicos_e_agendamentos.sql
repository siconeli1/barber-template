-- Verificacao final de consistencia para producao
-- Execute no SQL Editor do Supabase

-- 1) Catalogo de servicos ativos
SELECT id, codigo, nome, duracao_minutos, preco, ativo, ordem
FROM public.servicos
ORDER BY ordem, nome;

-- 2) Deve retornar 0 para considerar padronizado
SELECT COUNT(*) AS servicos_fora_do_catalogo
FROM public.servicos
WHERE ativo = true
  AND codigo NOT IN (
    'barba',
    'cabelo',
    'corte_barba',
    'combo_barba_corte_sobrancelha',
    'acabamento_pezinho'
  );

-- 3) Status validos nos agendamentos
SELECT status, COUNT(*)
FROM public.agendamentos
GROUP BY status
ORDER BY status;

-- 4) Agendamentos sem dados de servico (deve ser 0 para novos registros)
-- Se as colunas ainda não existirem, retorna aviso em vez de falhar.
DO $$
DECLARE
  has_servico_nome boolean;
  has_servico_duracao boolean;
  has_servico_preco boolean;
  total_sem_dados bigint;
BEGIN
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

  IF has_servico_nome AND has_servico_duracao AND has_servico_preco THEN
    EXECUTE '
      SELECT COUNT(*)
      FROM public.agendamentos
      WHERE status = ''ativo''
        AND (
          servico_nome IS NULL
          OR servico_duracao_minutos IS NULL
          OR servico_preco IS NULL
        )
    ' INTO total_sem_dados;

    RAISE NOTICE 'agendamentos_sem_servico = %', total_sem_dados;
  ELSE
    RAISE NOTICE 'colunas de servico ainda nao existem em public.agendamentos (servico_nome/servico_duracao_minutos/servico_preco).';
  END IF;
END $$;

-- 5) Distribuicao de duracao dos agendamentos ativos
DO $$
DECLARE
  has_servico_duracao boolean;
  rec record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamentos'
      AND column_name = 'servico_duracao_minutos'
  ) INTO has_servico_duracao;

  IF has_servico_duracao THEN
    RAISE NOTICE 'distribuicao de duracao (ativo):';
    FOR rec IN EXECUTE '
      SELECT servico_duracao_minutos, COUNT(*) AS total
      FROM public.agendamentos
      WHERE status = ''ativo''
      GROUP BY servico_duracao_minutos
      ORDER BY servico_duracao_minutos
    '
    LOOP
      RAISE NOTICE 'duracao=% min | total=%', rec.servico_duracao_minutos, rec.total;
    END LOOP;
  ELSE
    RAISE NOTICE 'coluna servico_duracao_minutos nao existe em public.agendamentos.';
  END IF;
END $$;

-- 6) Faturamento diario (ultimos 15 dias)
DO $$
DECLARE
  has_servico_preco boolean;
  rec record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agendamentos'
      AND column_name = 'servico_preco'
  ) INTO has_servico_preco;

  IF has_servico_preco THEN
    RAISE NOTICE 'faturamento diario (ultimos 15 dias):';
    FOR rec IN EXECUTE '
      SELECT data, COUNT(*) AS total_agendamentos, COALESCE(SUM(servico_preco), 0) AS faturamento
      FROM public.agendamentos
      WHERE status = ''ativo''
        AND data >= (CURRENT_DATE - INTERVAL ''15 day'')
      GROUP BY data
      ORDER BY data DESC
    '
    LOOP
      RAISE NOTICE 'data=% | total=% | faturamento=%', rec.data, rec.total_agendamentos, rec.faturamento;
    END LOOP;
  ELSE
    RAISE NOTICE 'coluna servico_preco nao existe em public.agendamentos.';
  END IF;
END $$;
