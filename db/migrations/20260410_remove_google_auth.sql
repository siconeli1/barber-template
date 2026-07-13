-- Migration: Remove Google Auth dependency
-- Remove obrigatoriedade do auth_user_id e adicionar UNIQUE no telefone

-- 1. Tornar auth_user_id opcional na tabela clientes
ALTER TABLE public.clientes
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- 2. Remover a constraint de FK para auth.users (se existir)
-- Isso permite clientes sem conta Google
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_auth_user_id_fkey;

-- 3. Adicionar constraint UNIQUE no telefone (identificador primario)
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_telefone_unique UNIQUE (telefone);

-- 4. Remover index unico em auth_user_id (nao e mais o identificador principal)
DROP INDEX IF EXISTS public.clientes_auth_user_id_key;

-- 5. Tornar auth_user_id opcional na tabela agendamentos
ALTER TABLE public.agendamentos
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- 6. Remover FK de agendamentos.auth_user_id para auth.users (se existir)
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_auth_user_id_fkey;
