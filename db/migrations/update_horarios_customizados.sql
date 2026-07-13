-- Adicionar colunas de cliente na tabela horarios_customizados
-- Execute este SQL no SQL Editor do Supabase

ALTER TABLE public.horarios_customizados
ADD COLUMN IF NOT EXISTS nome_cliente TEXT,
ADD COLUMN IF NOT EXISTS celular_cliente TEXT;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_horarios_customizados_cliente
  ON public.horarios_customizados(nome_cliente);
