// Remove modelos duplicados pela image_url (mesma URL = mesma foto)
// Uso: node scripts/dedup-by-url.mjs
// Mantém o registro com ID menor (mais antigo) e deleta os demais.

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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("🔍 Buscando todos os modelos...");
  const { data: models, error } = await supabase
    .from("models")
    .select("id, image_url, original_filename, category")
    .order("id", { ascending: true }); // menor id = mais antigo = mantém

  if (error) { console.error("❌", error.message); process.exit(1); }
  console.log(`📦 ${models.length} modelos no banco`);

  // Agrupar por image_url
  const byUrl = {};
  for (const m of models) {
    if (!byUrl[m.image_url]) byUrl[m.image_url] = [];
    byUrl[m.image_url].push(m);
  }

  // Coletar duplicatas (todos exceto o primeiro de cada grupo)
  const toDelete = [];
  for (const [url, group] of Object.entries(byUrl)) {
    if (group.length > 1) {
      // mantém group[0] (menor id), deleta o resto
      toDelete.push(...group.slice(1));
    }
  }

  if (toDelete.length === 0) {
    console.log("✅ Nenhuma duplicata encontrada por image_url!");
    return;
  }

  console.log(`\n🗑️  ${toDelete.length} duplicata(s) encontrada(s):`);
  for (const m of toDelete) {
    const filename = m.original_filename ?? m.image_url.split("/").pop();
    console.log(`   id=${m.id} | ${filename} | ${m.category}`);
  }

  const ids = toDelete.map((m) => m.id);
  const { error: delErr } = await supabase.from("models").delete().in("id", ids);

  if (delErr) {
    console.error("❌ Erro ao deletar:", delErr.message);
  } else {
    console.log(`\n✅ ${ids.length} duplicata(s) removida(s)!`);
  }

  // Contagem final
  const { count } = await supabase.from("models").select("*", { count: "exact", head: true });
  console.log(`📊 Total final: ${count} modelos únicos`);
}

main().catch(console.error);
