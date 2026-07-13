BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_admin_login_attempts') THEN
    CREATE TRIGGER set_timestamp_admin_login_attempts
    BEFORE UPDATE ON public.admin_login_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_agendamento_atomic(
  p_agendamento JSONB,
  p_itens JSONB
)
RETURNS public.agendamentos
LANGUAGE plpgsql
AS $$
DECLARE
  v_agendamento public.agendamentos;
  v_item JSONB;
  v_assinatura public.assinaturas;
  v_cliente_id UUID := NULLIF(p_agendamento->>'cliente_id', '')::UUID;
  v_assinatura_id UUID;
  v_creditos_corte INTEGER;
  v_creditos_barba INTEGER;
  v_creditos_sobrancelha INTEGER;
BEGIN
  INSERT INTO public.agendamentos (
    barbeiro_id,
    cliente_id,
    auth_user_id,
    assinatura_id,
    data,
    hora_inicio,
    hora_fim,
    nome_cliente,
    celular_cliente,
    servico_id,
    servico_nome,
    servico_duracao_minutos,
    servico_preco,
    valor_tabela,
    desconto,
    acrescimo,
    valor_final,
    status,
    status_agendamento,
    status_atendimento,
    status_pagamento,
    origem_agendamento,
    tipo_cobranca,
    cancelavel_ate,
    observacoes
  )
  VALUES (
    p_agendamento->>'barbeiro_id',
    NULLIF(p_agendamento->>'cliente_id', '')::UUID,
    NULLIF(p_agendamento->>'auth_user_id', '')::UUID,
    NULLIF(p_agendamento->>'assinatura_id', '')::UUID,
    (p_agendamento->>'data')::DATE,
    (p_agendamento->>'hora_inicio')::TIME,
    (p_agendamento->>'hora_fim')::TIME,
    p_agendamento->>'nome_cliente',
    p_agendamento->>'celular_cliente',
    NULLIF(p_agendamento->>'servico_id', ''),
    p_agendamento->>'servico_nome',
    COALESCE((p_agendamento->>'servico_duracao_minutos')::INTEGER, 0),
    COALESCE((p_agendamento->>'servico_preco')::NUMERIC, 0),
    COALESCE((p_agendamento->>'valor_tabela')::NUMERIC, 0),
    COALESCE((p_agendamento->>'desconto')::NUMERIC, 0),
    COALESCE((p_agendamento->>'acrescimo')::NUMERIC, 0),
    COALESCE((p_agendamento->>'valor_final')::NUMERIC, 0),
    COALESCE(p_agendamento->>'status', 'ativo'),
    COALESCE(p_agendamento->>'status_agendamento', 'agendado'),
    COALESCE(p_agendamento->>'status_atendimento', 'pendente'),
    COALESCE(p_agendamento->>'status_pagamento', 'pendente'),
    COALESCE(p_agendamento->>'origem_agendamento', 'site'),
    COALESCE(p_agendamento->>'tipo_cobranca', 'avulso'),
    NULLIF(p_agendamento->>'cancelavel_ate', '')::TIMESTAMPTZ,
    NULLIF(p_agendamento->>'observacoes', '')
  )
  RETURNING * INTO v_agendamento;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_itens, '[]'::JSONB))
  LOOP
    INSERT INTO public.agendamento_itens (
      agendamento_id,
      assinatura_id,
      servico_id,
      servico_nome,
      servico_categoria,
      servico_duracao_minutos,
      servico_preco,
      tipo_cobranca,
      status_credito,
      creditos_corte,
      creditos_barba,
      creditos_sobrancelha,
      ordem
    )
    VALUES (
      v_agendamento.id,
      NULLIF(v_item->>'assinatura_id', '')::UUID,
      NULLIF(v_item->>'servico_id', ''),
      v_item->>'servico_nome',
      v_item->>'servico_categoria',
      COALESCE((v_item->>'servico_duracao_minutos')::INTEGER, 0),
      COALESCE((v_item->>'servico_preco')::NUMERIC, 0),
      v_item->>'tipo_cobranca',
      COALESCE(v_item->>'status_credito', 'nao_aplicavel'),
      COALESCE((v_item->>'creditos_corte')::INTEGER, 0),
      COALESCE((v_item->>'creditos_barba')::INTEGER, 0),
      COALESCE((v_item->>'creditos_sobrancelha')::INTEGER, 0),
      COALESCE((v_item->>'ordem')::INTEGER, 0)
    );

    v_assinatura_id := NULLIF(v_item->>'assinatura_id', '')::UUID;

    IF v_assinatura_id IS NULL OR COALESCE(v_item->>'tipo_cobranca', '') <> 'plano' THEN
      CONTINUE;
    END IF;

    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Cliente vinculado obrigatorio para reservar credito de plano.';
    END IF;

    SELECT *
    INTO v_assinatura
    FROM public.assinaturas
    WHERE id = v_assinatura_id
    FOR UPDATE;

    IF NOT FOUND OR v_assinatura.cliente_id <> v_cliente_id OR v_assinatura.status <> 'ativo' THEN
      RAISE EXCEPTION 'Assinatura ativa nao encontrada.';
    END IF;

    v_creditos_corte := COALESCE((v_item->>'creditos_corte')::INTEGER, 0);
    v_creditos_barba := COALESCE((v_item->>'creditos_barba')::INTEGER, 0);
    v_creditos_sobrancelha := COALESCE((v_item->>'creditos_sobrancelha')::INTEGER, 0);

    IF v_creditos_corte > 0 THEN
      IF COALESCE(v_assinatura.cortes_restantes, 0) < v_creditos_corte THEN
        RAISE EXCEPTION 'Saldo insuficiente no plano.';
      END IF;

      UPDATE public.assinaturas
      SET cortes_restantes = cortes_restantes - v_creditos_corte,
          cortes_reservados = cortes_reservados + v_creditos_corte
      WHERE id = v_assinatura_id;

      INSERT INTO public.assinatura_movimentacoes (
        assinatura_id,
        cliente_id,
        categoria_servico,
        tipo_movimentacao,
        quantidade,
        agendamento_id,
        observacao
      )
      VALUES (
        v_assinatura_id,
        v_cliente_id,
        'corte',
        'reserva_credito',
        v_creditos_corte,
        v_agendamento.id,
        'Reserva do servico ' || COALESCE(v_item->>'servico_nome', '')
      );
    END IF;

    IF v_creditos_barba > 0 THEN
      IF COALESCE(v_assinatura.barbas_restantes, 0) < v_creditos_barba THEN
        RAISE EXCEPTION 'Saldo insuficiente no plano.';
      END IF;

      UPDATE public.assinaturas
      SET barbas_restantes = barbas_restantes - v_creditos_barba,
          barbas_reservadas = barbas_reservadas + v_creditos_barba
      WHERE id = v_assinatura_id;

      INSERT INTO public.assinatura_movimentacoes (
        assinatura_id,
        cliente_id,
        categoria_servico,
        tipo_movimentacao,
        quantidade,
        agendamento_id,
        observacao
      )
      VALUES (
        v_assinatura_id,
        v_cliente_id,
        'barba',
        'reserva_credito',
        v_creditos_barba,
        v_agendamento.id,
        'Reserva do servico ' || COALESCE(v_item->>'servico_nome', '')
      );
    END IF;

    IF v_creditos_sobrancelha > 0 THEN
      IF COALESCE(v_assinatura.sobrancelhas_restantes, 0) < v_creditos_sobrancelha THEN
        RAISE EXCEPTION 'Saldo insuficiente no plano.';
      END IF;

      UPDATE public.assinaturas
      SET sobrancelhas_restantes = sobrancelhas_restantes - v_creditos_sobrancelha,
          sobrancelhas_reservadas = sobrancelhas_reservadas + v_creditos_sobrancelha
      WHERE id = v_assinatura_id;

      INSERT INTO public.assinatura_movimentacoes (
        assinatura_id,
        cliente_id,
        categoria_servico,
        tipo_movimentacao,
        quantidade,
        agendamento_id,
        observacao
      )
      VALUES (
        v_assinatura_id,
        v_cliente_id,
        'sobrancelha',
        'reserva_credito',
        v_creditos_sobrancelha,
        v_agendamento.id,
        'Reserva do servico ' || COALESCE(v_item->>'servico_nome', '')
      );
    END IF;
  END LOOP;

  RETURN v_agendamento;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_assinatura_with_receita_atomic(
  p_payload JSONB,
  p_plano_nome TEXT,
  p_valor NUMERIC,
  p_competencia DATE,
  p_observacao TEXT
)
RETURNS public.assinaturas
LANGUAGE plpgsql
AS $$
DECLARE
  v_assinatura public.assinaturas;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assinaturas
    WHERE cliente_id = (p_payload->>'cliente_id')::UUID
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Cliente ja possui um plano ativo.';
  END IF;

  INSERT INTO public.assinaturas (
    cliente_id,
    plano_id,
    status,
    tipo_renovacao,
    inicio_ciclo,
    fim_ciclo,
    proxima_renovacao,
    cortes_totais,
    cortes_restantes,
    cortes_reservados,
    barbas_totais,
    barbas_restantes,
    barbas_reservadas,
    sobrancelhas_totais,
    sobrancelhas_restantes,
    sobrancelhas_reservadas,
    observacoes_internas
  )
  VALUES (
    (p_payload->>'cliente_id')::UUID,
    p_payload->>'plano_id',
    COALESCE(p_payload->>'status', 'ativo'),
    COALESCE(p_payload->>'tipo_renovacao', 'manual'),
    (p_payload->>'inicio_ciclo')::DATE,
    (p_payload->>'fim_ciclo')::DATE,
    (p_payload->>'proxima_renovacao')::DATE,
    COALESCE((p_payload->>'cortes_totais')::INTEGER, 0),
    COALESCE((p_payload->>'cortes_restantes')::INTEGER, 0),
    COALESCE((p_payload->>'cortes_reservados')::INTEGER, 0),
    COALESCE((p_payload->>'barbas_totais')::INTEGER, 0),
    COALESCE((p_payload->>'barbas_restantes')::INTEGER, 0),
    COALESCE((p_payload->>'barbas_reservadas')::INTEGER, 0),
    COALESCE((p_payload->>'sobrancelhas_totais')::INTEGER, 0),
    COALESCE((p_payload->>'sobrancelhas_restantes')::INTEGER, 0),
    COALESCE((p_payload->>'sobrancelhas_reservadas')::INTEGER, 0),
    NULLIF(p_payload->>'observacoes_internas', '')
  )
  RETURNING * INTO v_assinatura;

  INSERT INTO public.assinatura_movimentacoes (
    assinatura_id,
    cliente_id,
    categoria_servico,
    tipo_movimentacao,
    quantidade,
    observacao
  )
  VALUES (
    v_assinatura.id,
    v_assinatura.cliente_id,
    'outro',
    'renovacao',
    1,
    p_observacao
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.financeiro_lancamentos
    WHERE assinatura_id = v_assinatura.id
      AND categoria_financeira = 'receita_plano_mensal'
      AND competencia = p_competencia
      AND descricao = 'Plano mensal: ' || p_plano_nome
  ) THEN
    INSERT INTO public.financeiro_lancamentos (
      cliente_id,
      assinatura_id,
      categoria_financeira,
      descricao,
      valor,
      competencia
    )
    VALUES (
      v_assinatura.cliente_id,
      v_assinatura.id,
      'receita_plano_mensal',
      'Plano mensal: ' || p_plano_nome,
      p_valor,
      p_competencia
    );
  END IF;

  RETURN v_assinatura;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_assinatura_with_receita_atomic(
  p_assinatura_id UUID,
  p_patch JSONB,
  p_plano_nome TEXT,
  p_valor NUMERIC,
  p_competencia DATE,
  p_observacao TEXT
)
RETURNS public.assinaturas
LANGUAGE plpgsql
AS $$
DECLARE
  v_assinatura public.assinaturas;
BEGIN
  SELECT *
  INTO v_assinatura
  FROM public.assinaturas
  WHERE id = p_assinatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura nao encontrada.';
  END IF;

  UPDATE public.assinaturas
  SET plano_id = COALESCE(p_patch->>'plano_id', v_assinatura.plano_id),
      status = COALESCE(p_patch->>'status', v_assinatura.status),
      inicio_ciclo = COALESCE((p_patch->>'inicio_ciclo')::DATE, v_assinatura.inicio_ciclo),
      fim_ciclo = COALESCE((p_patch->>'fim_ciclo')::DATE, v_assinatura.fim_ciclo),
      proxima_renovacao = COALESCE((p_patch->>'proxima_renovacao')::DATE, v_assinatura.proxima_renovacao),
      cortes_totais = COALESCE((p_patch->>'cortes_totais')::INTEGER, v_assinatura.cortes_totais),
      cortes_restantes = COALESCE((p_patch->>'cortes_restantes')::INTEGER, v_assinatura.cortes_restantes),
      cortes_reservados = COALESCE((p_patch->>'cortes_reservados')::INTEGER, v_assinatura.cortes_reservados),
      barbas_totais = COALESCE((p_patch->>'barbas_totais')::INTEGER, v_assinatura.barbas_totais),
      barbas_restantes = COALESCE((p_patch->>'barbas_restantes')::INTEGER, v_assinatura.barbas_restantes),
      barbas_reservadas = COALESCE((p_patch->>'barbas_reservadas')::INTEGER, v_assinatura.barbas_reservadas),
      sobrancelhas_totais = COALESCE((p_patch->>'sobrancelhas_totais')::INTEGER, v_assinatura.sobrancelhas_totais),
      sobrancelhas_restantes = COALESCE((p_patch->>'sobrancelhas_restantes')::INTEGER, v_assinatura.sobrancelhas_restantes),
      sobrancelhas_reservadas = COALESCE((p_patch->>'sobrancelhas_reservadas')::INTEGER, v_assinatura.sobrancelhas_reservadas),
      observacoes_internas = COALESCE(NULLIF(p_patch->>'observacoes_internas', ''), v_assinatura.observacoes_internas)
  WHERE id = p_assinatura_id
  RETURNING * INTO v_assinatura;

  INSERT INTO public.assinatura_movimentacoes (
    assinatura_id,
    cliente_id,
    categoria_servico,
    tipo_movimentacao,
    quantidade,
    observacao
  )
  VALUES (
    v_assinatura.id,
    v_assinatura.cliente_id,
    'outro',
    'renovacao',
    1,
    p_observacao
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.financeiro_lancamentos
    WHERE assinatura_id = v_assinatura.id
      AND categoria_financeira = 'receita_plano_mensal'
      AND competencia = p_competencia
      AND descricao = 'Plano mensal: ' || p_plano_nome
  ) THEN
    INSERT INTO public.financeiro_lancamentos (
      cliente_id,
      assinatura_id,
      categoria_financeira,
      descricao,
      valor,
      competencia
    )
    VALUES (
      v_assinatura.cliente_id,
      v_assinatura.id,
      'receita_plano_mensal',
      'Plano mensal: ' || p_plano_nome,
      p_valor,
      p_competencia
    );
  END IF;

  RETURN v_assinatura;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_agendamento_update_atomic(
  p_agendamento_id UUID,
  p_barbeiro_id TEXT,
  p_patch JSONB
)
RETURNS public.agendamentos
LANGUAGE plpgsql
AS $$
DECLARE
  v_agendamento public.agendamentos;
  v_item RECORD;
  v_assinatura public.assinaturas;
  v_tipo_credito TEXT;
  v_status_agendamento TEXT := NULLIF(p_patch->>'status_agendamento', '');
  v_status_atendimento TEXT := NULLIF(p_patch->>'status_atendimento', '');
  v_descricao TEXT;
BEGIN
  UPDATE public.agendamentos
  SET status = COALESCE(NULLIF(p_patch->>'status', ''), status),
      status_agendamento = COALESCE(v_status_agendamento, status_agendamento),
      status_atendimento = COALESCE(v_status_atendimento, status_atendimento),
      status_pagamento = COALESCE(NULLIF(p_patch->>'status_pagamento', ''), status_pagamento),
      desconto = COALESCE((p_patch->>'desconto')::NUMERIC, desconto),
      acrescimo = COALESCE((p_patch->>'acrescimo')::NUMERIC, acrescimo),
      valor_final = COALESCE((p_patch->>'valor_final')::NUMERIC, valor_final),
      forma_pagamento = CASE
        WHEN p_patch ? 'forma_pagamento' THEN NULLIF(p_patch->>'forma_pagamento', '')
        ELSE forma_pagamento
      END,
      observacoes = CASE
        WHEN p_patch ? 'observacoes' THEN NULLIF(p_patch->>'observacoes', '')
        ELSE observacoes
      END,
      concluido_em = COALESCE(NULLIF(p_patch->>'concluido_em', '')::TIMESTAMPTZ, concluido_em),
      cancelado_em = COALESCE(NULLIF(p_patch->>'cancelado_em', '')::TIMESTAMPTZ, cancelado_em)
  WHERE id = p_agendamento_id
    AND barbeiro_id = p_barbeiro_id
  RETURNING * INTO v_agendamento;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF v_status_agendamento = 'cancelado' THEN
    v_tipo_credito := 'devolucao_credito';
  ELSIF v_status_agendamento = 'no_show' OR v_status_atendimento = 'concluido' THEN
    v_tipo_credito := 'consumo_credito';
  ELSE
    v_tipo_credito := NULL;
  END IF;

  IF v_tipo_credito IS NOT NULL THEN
    FOR v_item IN
      SELECT *
      FROM public.agendamento_itens
      WHERE agendamento_id = p_agendamento_id
        AND status_credito = 'reservado'
    LOOP
      IF v_item.assinatura_id IS NOT NULL THEN
        SELECT *
        INTO v_assinatura
        FROM public.assinaturas
        WHERE id = v_item.assinatura_id
        FOR UPDATE;

        IF FOUND THEN
          IF COALESCE(v_item.creditos_corte, 0) > 0 THEN
            UPDATE public.assinaturas
            SET cortes_reservados = cortes_reservados - v_item.creditos_corte,
                cortes_restantes = CASE
                  WHEN v_tipo_credito = 'devolucao_credito' THEN cortes_restantes + v_item.creditos_corte
                  ELSE cortes_restantes
                END
            WHERE id = v_item.assinatura_id;

            INSERT INTO public.assinatura_movimentacoes (
              assinatura_id,
              cliente_id,
              categoria_servico,
              tipo_movimentacao,
              quantidade,
              agendamento_id
            )
            VALUES (
              v_item.assinatura_id,
              v_agendamento.cliente_id,
              'corte',
              v_tipo_credito,
              v_item.creditos_corte,
              p_agendamento_id
            );
          END IF;

          IF COALESCE(v_item.creditos_barba, 0) > 0 THEN
            UPDATE public.assinaturas
            SET barbas_reservadas = barbas_reservadas - v_item.creditos_barba,
                barbas_restantes = CASE
                  WHEN v_tipo_credito = 'devolucao_credito' THEN barbas_restantes + v_item.creditos_barba
                  ELSE barbas_restantes
                END
            WHERE id = v_item.assinatura_id;

            INSERT INTO public.assinatura_movimentacoes (
              assinatura_id,
              cliente_id,
              categoria_servico,
              tipo_movimentacao,
              quantidade,
              agendamento_id
            )
            VALUES (
              v_item.assinatura_id,
              v_agendamento.cliente_id,
              'barba',
              v_tipo_credito,
              v_item.creditos_barba,
              p_agendamento_id
            );
          END IF;

          IF COALESCE(v_item.creditos_sobrancelha, 0) > 0 THEN
            UPDATE public.assinaturas
            SET sobrancelhas_reservadas = sobrancelhas_reservadas - v_item.creditos_sobrancelha,
                sobrancelhas_restantes = CASE
                  WHEN v_tipo_credito = 'devolucao_credito' THEN sobrancelhas_restantes + v_item.creditos_sobrancelha
                  ELSE sobrancelhas_restantes
                END
            WHERE id = v_item.assinatura_id;

            INSERT INTO public.assinatura_movimentacoes (
              assinatura_id,
              cliente_id,
              categoria_servico,
              tipo_movimentacao,
              quantidade,
              agendamento_id
            )
            VALUES (
              v_item.assinatura_id,
              v_agendamento.cliente_id,
              'sobrancelha',
              v_tipo_credito,
              v_item.creditos_sobrancelha,
              p_agendamento_id
            );
          END IF;
        END IF;
      END IF;

      UPDATE public.agendamento_itens
      SET status_credito = CASE
        WHEN v_tipo_credito = 'consumo_credito' THEN 'consumido'
        ELSE 'devolvido'
      END
      WHERE id = v_item.id;
    END LOOP;
  END IF;

  IF v_status_atendimento = 'concluido' THEN
    FOR v_item IN
      SELECT servico_nome, servico_preco
      FROM public.agendamento_itens
      WHERE agendamento_id = p_agendamento_id
        AND tipo_cobranca = 'avulso'
    LOOP
      v_descricao := 'Servico avulso: ' || v_item.servico_nome;

      IF NOT EXISTS (
        SELECT 1
        FROM public.financeiro_lancamentos
        WHERE agendamento_id = p_agendamento_id
          AND categoria_financeira = 'receita_servico_avulso'
          AND descricao = v_descricao
      ) THEN
        INSERT INTO public.financeiro_lancamentos (
          cliente_id,
          agendamento_id,
          categoria_financeira,
          descricao,
          valor,
          competencia
        )
        VALUES (
          v_agendamento.cliente_id,
          p_agendamento_id,
          'receita_servico_avulso',
          v_descricao,
          COALESCE(v_item.servico_preco, 0),
          v_agendamento.data
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_agendamento;
END;
$$;

COMMIT;
