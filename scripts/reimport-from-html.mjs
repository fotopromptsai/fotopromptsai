// Reimportação limpa a partir dos arquivos HTML do Telegram
// Uso: node scripts/reimport-from-html.mjs
//
// O que faz:
//   1. Parseia messages.html + messages2.html extraindo pares foto → prompt
//   2. Deduplica por nome de arquivo (remove fotos repetidas)
//   3. Pergunta confirmação antes de apagar o banco
//   4. Deleta TODOS os models existentes no Supabase
//   5. Re-importa somente os pares únicos
//
// Requisitos:
//   - VITE_DB_SUPABASE_URL + VITE_DB_SUPABASE_SERVICE_KEY no .env

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Configuração ──────────────────────────────────────────────────────────

const TELEGRAM_DIR = "C:\\Users\\leocl\\Desktop\\App Ensaio de Fotos";
const HTML_FILES   = ["messages.html", "messages2.html"];

// ─── .env ──────────────────────────────────────────────────────────────────

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
  console.warn("⚠️  Usando anon key — pode falhar por RLS. Prefira VITE_DB_SUPABASE_SERVICE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ─── Categorias ────────────────────────────────────────────────────────────

function detectCategory(prompt) {
  const p = prompt.toLowerCase();
  if (/maternity|gestante|gravidez|pregnant|baby\s*bump|gr[aá]vida|maternidade|barriga\s+gr[aá]v|barriga\s+de\s+gr/.test(p)) return "Gestante";
  if (/newborn|rec[eé]m.nascido|beb[eê]|neonatal/.test(p)) return "Newborn";
  if (/christmas|natal|festivo|natalino|xmas|papai\s*noel|neve/.test(p)) return "Natal";
  if (/beach|praia|mar\b|areia|oceano|orla/.test(p)) return "Praia";
  if (/fashion|editorial|vogue|runway|pasarela|fashion\s*week/.test(p)) return "Editorial";
  if (/\bfamily\b|fam[ií]lia|pais\s+e\s+filh|m[ãa]e\s+e\s+filh|pai\s+e\s+filh|casal\s+com|retrato\s+de\s+fam|foto\s+de\s+fam|group\s+portrait|family\s+portrait|\bcouple\b|\bcasal\b/.test(p)) return "Família";
  return "Geral";
}

// ─── Parser HTML ───────────────────────────────────────────────────────────

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function parseHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, "utf-8");
  const pairs = [];
  let currentPhoto = null;

  // Tokenize: split on photo hrefs and text divs
  // We scan the whole file line by line and extract in order

  // Photo pattern: href="photos/photo_X@date.jpg" (not thumb)
  const photoRe = /href="(photos\/[^"]+\.jpg)"/g;
  // Text block: <div class="text">...(multiline)...</div>
  // We'll extract text blocks separately then zip with photo positions

  // Strategy: find all tokens (photo or text) in document order by offset
  const tokens = [];

  let m;
  // Photos
  const photoReG = /href="(photos\/(?!.*_thumb)[^"]+\.jpg)"/g;
  while ((m = photoReG.exec(html)) !== null) {
    tokens.push({ type: "photo", pos: m.index, filename: path.basename(m[1]) });
  }

  // Text divs — multiline content between <div class="text"> and </div>
  const textReG = /<div class="text">([\s\S]*?)<\/div>/g;
  while ((m = textReG.exec(html)) !== null) {
    const raw = m[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")  // strip any remaining tags
      .trim();
    const decoded = decodeHtmlEntities(raw);
    if (decoded.length > 20) { // ignore very short/empty text divs
      tokens.push({ type: "text", pos: m.index, content: decoded });
    }
  }

  // Sort by document position
  tokens.sort((a, b) => a.pos - b.pos);

  // Pair: last photo before each text
  let pendingPhoto = null;
  for (const tok of tokens) {
    if (tok.type === "photo") {
      pendingPhoto = tok.filename;
    } else if (tok.type === "text" && pendingPhoto) {
      pairs.push({ filename: pendingPhoto, prompt: tok.content });
      pendingPhoto = null;
    }
  }

  return pairs;
}

// ─── Utilitário readline ───────────────────────────────────────────────────

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim().toLowerCase()); });
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("📂 Lendo arquivos HTML...\n");

  const allPairs = [];
  for (const htmlFile of HTML_FILES) {
    const filePath = path.join(TELEGRAM_DIR, htmlFile);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Arquivo não encontrado: ${filePath}`);
      continue;
    }
    const pairs = parseHtmlFile(filePath);
    console.log(`   ${htmlFile}: ${pairs.length} pares foto+prompt encontrados`);
    allPairs.push(...pairs);
  }

  console.log(`\n📊 Total bruto: ${allPairs.length} pares`);

  // Deduplica por filename E por prompt exato (mantém primeira ocorrência)
  const seenFilenames = new Set();
  const seenPrompts = new Set();
  const uniquePairs = [];
  let dupFilename = 0, dupPrompt = 0;

  for (const pair of allPairs) {
    const promptKey = pair.prompt.trim().replace(/\s+/g, " "); // normaliza espaços
    if (seenFilenames.has(pair.filename)) {
      dupFilename++;
      continue;
    }
    if (seenPrompts.has(promptKey)) {
      dupPrompt++;
      continue;
    }
    seenFilenames.add(pair.filename);
    seenPrompts.add(promptKey);
    uniquePairs.push(pair);
  }

  const dupCount = dupFilename + dupPrompt;
  console.log(`🔁 Duplicatas removidas: ${dupCount} (${dupFilename} por filename, ${dupPrompt} por prompt idêntico)`);
  console.log(`✅ Pares únicos: ${uniquePairs.length}\n`);

  // Verifica quais arquivos existem em disco
  const photosDir = path.join(TELEGRAM_DIR, "photos");
  const withFile = uniquePairs.filter(({ filename }) => {
    const full = path.join(photosDir, filename);
    return fs.existsSync(full);
  });
  const missing = uniquePairs.length - withFile.length;
  if (missing > 0) console.warn(`⚠️  ${missing} fotos não encontradas em disco (serão ignoradas)`);
  console.log(`📷 Fotos prontas para importar: ${withFile.length}\n`);

  // Preview das categorias
  const catCount = {};
  for (const { prompt } of withFile) {
    const cat = detectCategory(prompt);
    catCount[cat] = (catCount[cat] ?? 0) + 1;
  }
  console.log("🏷️  Categorias detectadas:");
  for (const [cat, n] of Object.entries(catCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat.padEnd(12)} ${n}`);
  }

  console.log("\n⚠️  ATENÇÃO: Esta operação irá:");
  console.log("   1. APAGAR TODOS os modelos do banco (tabela models)");
  console.log("   2. Re-importar somente os pares únicos do HTML");
  console.log("\nDigite  sim  para continuar ou qualquer coisa para cancelar.");
  const ans = await ask("> ");
  if (ans !== "sim") { console.log("❌ Cancelado."); process.exit(0); }

  // ─── Apagar tudo ────────────────────────────────────────────────────────
  console.log("\n🗑️  Deletando todos os modelos existentes...");
  const { error: delErr } = await supabase.from("models").delete().not("id", "is", null);
  if (delErr) { console.error("❌ Erro ao deletar:", delErr.message); process.exit(1); }
  console.log("✅ Banco limpo.\n");

  // ─── Verificar bucket ────────────────────────────────────────────────────
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "models")) {
    console.error("❌ Bucket 'models' não encontrado no Storage.");
    process.exit(1);
  }

  // ─── Importar ────────────────────────────────────────────────────────────
  let imported = 0, errors = 0;

  for (let i = 0; i < withFile.length; i++) {
    const { filename, prompt } = withFile[i];
    const localPath = path.join(photosDir, filename);
    const storagePath = `catalog/${filename}`;

    // Upload
    const fileBuffer = fs.readFileSync(localPath);
    const { error: uploadErr } = await supabase.storage
      .from("models")
      .upload(storagePath, fileBuffer, { contentType: "image/jpeg", upsert: true });

    if (uploadErr && !uploadErr.message.includes("already exists")) {
      console.error(`\n❌ Upload ${filename}: ${uploadErr.message}`);
      errors++;
      continue;
    }

    const { data: urlData } = supabase.storage.from("models").getPublicUrl(storagePath);
    const imageUrl = urlData.publicUrl;
    const category = detectCategory(prompt);

    const { error: dbErr } = await supabase.from("models").insert({
      image_url: imageUrl,
      prompt,
      original_filename: filename,
      category,
    });

    if (dbErr) {
      console.error(`\n❌ DB ${filename}: ${dbErr.message}`);
      errors++;
      continue;
    }

    imported++;
    process.stdout.write(
      `\r✅ ${imported}/${withFile.length} importados | ❌ ${errors} erros`
    );
  }

  console.log(`\n\n🎉 Reimportação concluída!`);
  console.log(`   ✅ Importados: ${imported}`);
  console.log(`   ❌ Erros:      ${errors}`);
}

main().catch(console.error);
