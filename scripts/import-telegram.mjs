// Script de importação do Telegram export para Supabase
// Uso: node scripts/import-telegram.mjs
//
// Requisitos:
//   - result.json e pasta photos/ na pasta configurada em TELEGRAM_EXPORT_PATH
//   - VITE_DB_SUPABASE_URL e VITE_DB_SUPABASE_ANON_KEY no .env

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Carrega .env manualmente
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
const TELEGRAM_EXPORT_PATH = "C:\\Users\\leocl\\Desktop\\App Ensaio de Fotos";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ VITE_DB_SUPABASE_URL não encontrado no .env");
  process.exit(1);
}

if (!envVars.VITE_DB_SUPABASE_SERVICE_KEY) {
  console.warn("⚠️  Usando anon key — adicione VITE_DB_SUPABASE_SERVICE_KEY no .env para evitar erros de RLS");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function detectCategory(prompt) {
  const p = prompt.toLowerCase();
  if (/maternity|gestante|gravidez|pregnant|baby\s*bump|gr[aá]vida|maternidade|barriga\s+gr[aá]v|barriga\s+de\s+gr/.test(p)) return "Gestante";
  if (/newborn|rec[eé]m.nascido|beb[eê]|neonatal/.test(p)) return "Newborn";
  if (/christmas|natal|festivo|natalino|xmas|papai\s*noel|neve/.test(p)) return "Natal";
  if (/beach|praia|mar|areia|oceano|orla/.test(p)) return "Praia";
  if (/fashion|editorial|vogue|runway|pasarela|fashion\s*week/.test(p)) return "Editorial";
  if (/\bfamily\b|fam[ií]lia|pais\s+e\s+filh|m[ãa]e\s+e\s+filh|pai\s+e\s+filh|casal\s+com|retrato\s+de\s+fam|foto\s+de\s+fam|group\s+portrait|family\s+portrait|\bcouple\b|\bcasal\b/.test(p)) return "Família";
  return "Geral";
}

async function updateCategories() {
  console.log("\n🏷️  Atualizando categorias dos modelos existentes...");
  const { data: models, error } = await supabase
    .from("models")
    .select("id, prompt, category")
    .or("category.is.null,category.eq.Geral");

  if (error) { console.error("❌ Erro ao buscar modelos:", error.message); return; }
  if (!models?.length) { console.log("✅ Nenhum modelo para atualizar."); return; }

  let updated = 0;
  for (const model of models) {
    const category = detectCategory(model.prompt);
    if (category !== model.category) {
      await supabase.from("models").update({ category }).eq("id", model.id);
      updated++;
    }
  }
  console.log(`✅ ${updated} modelos categorizados.`);
}

async function main() {
  const jsonPath = path.join(TELEGRAM_EXPORT_PATH, "result.json");
  const photosDir = path.join(TELEGRAM_EXPORT_PATH, "photos");

  console.log("📂 Lendo result.json...");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const messages = data.messages;

  // Pareia foto → prompt
  const pairs = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];
    if (msg.photo && next.text && typeof next.text === "string" && next.text.trim()) {
      // Ignora thumbs
      if (!msg.photo.includes("_thumb")) {
        pairs.push({ photo: msg.photo, prompt: next.text.trim() });
      }
    }
  }

  console.log(`✅ ${pairs.length} pares foto+prompt encontrados`);

  // Verifica bucket
  const { data: buckets } = await supabase.storage.listBuckets();
  const hasBucket = buckets?.some((b) => b.name === "models");
  if (!hasBucket) {
    console.error("❌ Bucket 'models' não encontrado.");
    console.log("👉 Crie manualmente: Supabase > Storage > New Bucket > nome: models > marcar Público > Save");
    process.exit(1);
  }
  console.log("✅ Bucket 'models' encontrado.");

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < pairs.length; i++) {
    const { photo, prompt } = pairs[i];
    const filename = path.basename(photo);
    const localPath = path.join(photosDir, filename);

    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️  [${i + 1}/${pairs.length}] Arquivo não encontrado: ${filename}`);
      skipped++;
      continue;
    }

    // Verifica se já existe no banco
    const { data: existing } = await supabase
      .from("models")
      .select("id")
      .eq("original_filename", filename)
      .maybeSingle();

    if (existing) {
      skipped++;
      process.stdout.write(`\r⏭️  ${skipped} ignorados (já existem) | ${imported} importados`);
      continue;
    }

    // Upload da imagem
    const fileBuffer = fs.readFileSync(localPath);
    const storagePath = `catalog/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("models")
      .upload(storagePath, fileBuffer, { contentType: "image/jpeg", upsert: false });

    if (uploadError && !uploadError.message.includes("already exists")) {
      console.error(`\n❌ Erro upload ${filename}:`, uploadError.message);
      errors++;
      continue;
    }

    const { data: urlData } = supabase.storage.from("models").getPublicUrl(storagePath);
    const imageUrl = urlData.publicUrl;

    const category = detectCategory(prompt);

    // Salva no banco
    const { error: dbError } = await supabase.from("models").insert({
      image_url: imageUrl,
      prompt,
      original_filename: filename,
      category,
    });

    if (dbError) {
      console.error(`\n❌ Erro banco ${filename}:`, dbError.message);
      errors++;
      continue;
    }

    imported++;
    process.stdout.write(`\r✅ ${imported}/${pairs.length} importados | ⏭️  ${skipped} ignorados | ❌ ${errors} erros`);
  }

  console.log(`\n\n🎉 Importação concluída!`);
  console.log(`   ✅ Importados: ${imported}`);
  console.log(`   ⏭️  Ignorados:  ${skipped}`);
  console.log(`   ❌ Erros:      ${errors}`);

  await updateCategories();
}

main().catch(console.error);
