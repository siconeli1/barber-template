import { supabase } from "@/lib/supabase";
import { normalizePhone, isValidPhone } from "@/lib/phone";

function mapClientePersistenceError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("auth_user_id") && normalized.includes("not-null")) {
    return "O banco ainda esta no modelo antigo de Google. Aplique a migration 20260410_remove_google_auth.sql no Supabase.";
  }

  if (normalized.includes("duplicate key") || normalized.includes("clientes_telefone_unique")) {
    return "Ja existe um cadastro com esse telefone.";
  }

  return message;
}

export async function getClienteByTelefone(telefone: string) {
  const tel = normalizePhone(telefone);
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("telefone", tel)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    throw new Error(mapClientePersistenceError(error.message));
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
}

export async function findOrCreateCliente(nome: string, telefone: string) {
  const tel = normalizePhone(telefone);

  if (!isValidPhone(tel)) {
    throw new Error("Telefone inválido. Informe com DDD (ex: 17999998888).");
  }

  const existing = await getClienteByTelefone(tel);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ nome: nome.trim(), telefone: tel })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function getTelefoneFromRequest(request: Request): string | null {
  const headerTelefone = request.headers.get("x-customer-phone");
  if (headerTelefone) {
    return normalizePhone(headerTelefone);
  }

  const url = new URL(request.url);
  const queryTelefone = url.searchParams.get("telefone");
  if (queryTelefone) {
    return normalizePhone(queryTelefone);
  }

  return null;
}
