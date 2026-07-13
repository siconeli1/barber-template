import { access } from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();

const mustExist = [
  "app/page.tsx",
  "app/agendar/AgendarClient.tsx",
  "app/admin/page.tsx",
  "app/api/reservar/route.ts",
  "app/api/admin-agenda/route.ts",
  "lib/agendamento-planos.ts",
  "lib/assinaturas.ts",
];

const mustNotExist = [
  "app/api/teste/route.ts",
];

for (const relativePath of mustExist) {
  await access(path.join(cwd, relativePath));
}

for (const relativePath of mustNotExist) {
  try {
    await access(path.join(cwd, relativePath));
    throw new Error(`Arquivo legado ainda presente: ${relativePath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Arquivo legado")) {
      throw error;
    }
  }
}

console.log("Smoke check concluido com sucesso.");
