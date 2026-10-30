BEGIN;

-- O app acessa o banco so pelo servidor, com a service_role (que ignora RLS).
-- Ligar RLS sem policies fecha as tabelas para a chave anon/authenticated da API publica do Supabase.
ALTER TABLE public.barbeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_customizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_telefone_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinatura_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- As RPCs atomicas gravam direto no banco: so o servidor (service_role) pode chama-las.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Agendamentos criados pelo agente do Telegram (n8n) ficam identificados.
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_origem_agendamento_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_origem_agendamento_check
  CHECK (origem_agendamento IN ('site', 'admin_manual', 'horario_customizado', 'telegram'));

COMMIT;
