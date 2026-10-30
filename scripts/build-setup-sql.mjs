// Junta as migrations de db/migrations (em ordem de nome) em db/setup.sql,
// para criar um banco novo colando um unico arquivo no SQL Editor do Supabase.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "db", "migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const parts = files.map((name) => {
  const sql = readFileSync(join(migrationsDir, name), "utf8").replace(/^﻿/, "").trim();
  return `-- ===== ${name} =====\n${sql}\n`;
});

const header = [
  "-- Gerado por scripts/build-setup-sql.mjs (npm run db:setup). Nao edite a mao:",
  "-- altere db/migrations/ e gere de novo.",
  "-- Uso: projeto Supabase NOVO -> SQL Editor -> cole este arquivo inteiro -> Run.",
  "",
].join("\n");

writeFileSync(join(process.cwd(), "db", "setup.sql"), `${header}\n${parts.join("\n")}`);
console.log(`db/setup.sql gerado com ${files.length} migrations.`);
