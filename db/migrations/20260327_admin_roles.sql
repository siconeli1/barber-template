BEGIN;

ALTER TABLE public.barbeiros
  ADD COLUMN IF NOT EXISTS cargo TEXT NOT NULL DEFAULT 'barbeiro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'barbeiros_cargo_check'
      AND conrelid = 'public.barbeiros'::regclass
  ) THEN
    ALTER TABLE public.barbeiros
      ADD CONSTRAINT barbeiros_cargo_check
      CHECK (cargo IN ('socio', 'barbeiro'));
  END IF;
END $$;

UPDATE public.barbeiros
SET cargo = CASE
  WHEN id IN ('lucas-cantelle', 'ryan-ferreira') THEN 'socio'
  ELSE 'barbeiro'
END,
updated_at = timezone('utc', now());

COMMIT;
