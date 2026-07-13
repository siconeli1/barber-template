BEGIN;

ALTER TABLE public.clientes
  ALTER COLUMN data_nascimento DROP NOT NULL;

COMMIT;
