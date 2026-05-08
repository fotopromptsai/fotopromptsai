// Remove duplicatas da categoria Gestante no banco Supabase
// Uso: node scripts/deduplicate-gestante.mjs
//
// Estratégia:
//   1. Duplicatas por original_filename (mesmo arquivo importado 2x)
//   2. Duplicatas por image_url (mesma URL no Storage)
// Mantém sempre o registro mais antigo (id menor).

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const envPath = path.join(ROOT, ".env");
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length) envVars[k.trim()] = v.join("=").trim().replace(/^"|"$/g, "");
  });
}

const SUPABASE_URL = envVars.VITE_DB_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_DB_SUPABASE_SERVICE_KEY || envVars.VITE_DB_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ VITE_DB_SUPABASE_URL não encontrado no .env");
  process.exit(1);
}

if (!envVars.VITE_DB_SUPABASE_SERVICE_KEY) {
  console.warn("⚠️  Usando anon key — adicione VITE_DB_SUPABASE_SERVICE_KEY para garantir acesso total");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("🔍 Buscando todos os modelos Gestante...");
  const { data: models, error } = await supabase
    .from("models")
    .select("id, image_url, original_filename, created_at")
    .eq("category", "Gestante")
    .order("id", { ascending: true });

  if (error) { console.error("❌ Erro ao buscar modelos:", error.message); process.exit(1); }
  console.log(`📦 ${models.length} modelos Gestante encontrados`);

  const toDelete = new Set();

  // --- Duplicatas por original_filename ---
  const byFilename = {};
  for (const m of models) {
    if (!m.original_filename) continue;
    if (!byFilename[m.original_filename]) {
      byFilename[m.original_filename] = m.id; // primeiro (id menor = mais antigo)
    } else {
      toDelete.add(m.id);
    }
  }

  // --- Duplicatas por image_url ---
  const byUrl = {};
  for (const m of models) {
    if (!byUrl[m.image_url]) {
      byUrl[m.image_url] = m.id;
    } else {
      toDelete.add(m.id);
    }
  }

  if (toDelete.size === 0) {
    console.log("✅ Nenhuma duplicata encontrada. Tudo limpo!");
    return;
  }

  console.log(`\n🗑️  ${toDelete.size} duplicata(s) identificada(s):`);
  for (const id of toDelete) {
    const m = models.find((x) => x.id === id);
    console.log(`   • id=${id} | ${m?.original_filename ?? m?.image_url?.split("/").pop()}`);
  }

  console.log("\n⚠️  Confirme a exclusão digitando: sim");
  process.stdout.write("> ");

  const answer = await new Promise((resolve) => {
    process.stdin.once("data", (d) => resolve(d.toString().trim().toLowerCase()));
  });

  if (answer !== "sim") {
    console.log("❌ Operação cancelada.");
    process.exit(0);
  }

  const ids = Array.from(toDelete);
  const { error: delErr } = await supabase.from("models").delete().in("id", ids);

  if (delErr) {
    console.error("❌ Erro ao deletar:", delErr.message);
  } else {
    console.log(`✅ ${ids.length} duplicata(s) removida(s) com sucesso!`);
  }
}

main().catch(console.error);
