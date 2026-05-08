// Remove modelos duplicados pelo original_filename (normalizado)
// e também por image_url normalizada (decodifica %40, %20 etc.)
// Uso: node scripts/dedup-by-filename.mjs

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

function normalizeUrl(url) {
  try { return decodeURIComponent(url).toLowerCase().trim(); }
  catch { return url.toLowerCase().trim(); }
}

function filenameFromUrl(url) {
  try { return decodeURIComponent(url).split("/").pop().toLowerCase().trim(); }
  catch { return url.split("/").pop().toLowerCase().trim(); }
}

async function main() {
  console.log("🔍 Buscando todos os modelos...");
  const { data: models, error } = await supabase
    .from("models")
    .select("id, image_url, original_filename, category")
    .order("id", { ascending: true });

  if (error) { console.error("❌", error.message); process.exit(1); }
  console.log(`📦 ${models.length} modelos no banco\n`);

  // ── Diagnóstico: mostrar entradas de photo_86 ──────────────────────────
  const diag = models.filter(m =>
    (m.original_filename ?? "").includes("photo_86") ||
    (m.image_url ?? "").includes("photo_86")
  );
  if (diag.length > 0) {
    console.log(`🔎 Entradas encontradas com "photo_86":`);
    for (const m of diag) {
      console.log(`   id=${m.id}`);
      console.log(`   original_filename: ${m.original_filename}`);
      console.log(`   image_url: ${m.image_url}`);
      console.log(`   url_normalizada: ${normalizeUrl(m.image_url)}`);
      console.log();
    }
  }

  // ── Dedup 1: por original_filename normalizado ─────────────────────────
  const seenFilename = new Map(); // normalizedFilename → id do keeper
  const toDelete = new Set();

  for (const m of models) {
    const key = (m.original_filename ?? filenameFromUrl(m.image_url)).toLowerCase().trim();
    if (seenFilename.has(key)) {
      toDelete.add(m.id);
    } else {
      seenFilename.set(key, m.id);
    }
  }

  // ── Dedup 2: por image_url normalizada (URL decode) ────────────────────
  const seenUrl = new Map();
  for (const m of models) {
    if (toDelete.has(m.id)) continue; // já marcado
    const key = normalizeUrl(m.image_url);
    if (seenUrl.has(key)) {
      toDelete.add(m.id);
    } else {
      seenUrl.set(key, m.id);
    }
  }

  if (toDelete.size === 0) {
    console.log("✅ Nenhuma duplicata encontrada.");
    return;
  }

  console.log(`🗑️  ${toDelete.size} duplicata(s) a remover:`);
  for (const id of toDelete) {
    const m = models.find(x => x.id === id);
    console.log(`   id=${id} | ${m?.original_filename ?? filenameFromUrl(m?.image_url ?? "")}`);
  }

  const ids = Array.from(toDelete);
  const { error: delErr } = await supabase.from("models").delete().in("id", ids);
  if (delErr) {
    console.error("❌ Erro ao deletar:", delErr.message);
  } else {
    console.log(`\n✅ ${ids.length} duplicata(s) removida(s)!`);
  }

  const { count } = await supabase.from("models").select("*", { count: "exact", head: true });
  console.log(`📊 Total final: ${count} modelos únicos`);
}

main().catch(console.error);
