// Deleta modelos específicos pelo original_filename
// Uso: node scripts/delete-by-url.mjs
//
// Adicione os filenames a deletar na lista TO_DELETE abaixo.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Filenames a deletar ────────────────────────────────────────────────────
const TO_DELETE = [
  "photo_86@01-12-2025_13-04-21.jpg", // duplicata visual de photo_2@28-11-2025_11-04-03.jpg
];
// ──────────────────────────────────────────────────────────────────────────

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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log(`🔍 Procurando ${TO_DELETE.length} filename(s) no banco...\n`);

  const { data, error } = await supabase
    .from("models")
    .select("id, original_filename, category, image_url")
    .in("original_filename", TO_DELETE);

  if (error) { console.error("❌ Erro na query:", error.message); process.exit(1); }

  if (!data || data.length === 0) {
    console.log("⚠️  Nenhum registro encontrado com os filenames informados.");
    return;
  }

  console.log(`📋 Registros encontrados (${data.length}):`);
  for (const m of data) {
    console.log(`   id=${m.id} | ${m.original_filename} | ${m.category}`);
  }

  const ids = data.map((m) => m.id);
  const { error: delErr } = await supabase.from("models").delete().in("id", ids);

  if (delErr) {
    console.error("\n❌ Erro ao deletar:", delErr.message);
  } else {
    console.log(`\n✅ ${ids.length} registro(s) deletado(s) com sucesso!`);
  }
}

main().catch(console.error);
