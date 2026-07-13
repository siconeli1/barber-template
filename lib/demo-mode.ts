/**
 * Modo demo: sem SUPABASE_URL configurada, o template roda com armazenamento
 * local em JSON (data/demo-db.json) — nenhum banco externo e necessario.
 * Tambem pode ser forcado com DEMO_MODE=1 mesmo com Supabase configurado.
 */
export const DEMO_MODE = !process.env.SUPABASE_URL || process.env.DEMO_MODE === "1";

export const DEMO_ADMIN_LOGIN = "admin";
export const DEMO_ADMIN_PASSWORD = "1234";
