import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoSupabaseClient } from "@/lib/demo-db";
import { DEMO_MODE } from "@/lib/demo-mode";

function createRealClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Sem SUPABASE_URL o template roda em modo demo, com os dados gravados em
// data/demo-db.json (ver lib/demo-db.ts). O shim implementa o subconjunto da
// API do Supabase que o app usa, entao os dois modos sao intercambiaveis.
export const supabase: SupabaseClient = DEMO_MODE
  ? (createDemoSupabaseClient() as unknown as SupabaseClient)
  : createRealClient();
