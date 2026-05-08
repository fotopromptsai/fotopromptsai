import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const MAX_PER_IP = 1; // máximo de cadastros por IP

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "Email e senha obrigatórios." });

  const supabaseUrl = process.env.VITE_DB_SUPABASE_URL!;
  const serviceKey  = process.env.VITE_DB_SUPABASE_SERVICE_KEY!;
  const anonKey     = process.env.VITE_DB_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Configuração do servidor incompleta." });
  }

  // Cliente admin (bypass RLS)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Detectar IP real do cliente
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    "unknown";

  // Verificar limite por IP
  if (ip !== "unknown") {
    const { count } = await admin
      .from("ip_registrations")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip);

    if ((count ?? 0) >= MAX_PER_IP) {
      return res.status(403).json({
        error: "Limite de cadastros atingido para este dispositivo/rede.",
      });
    }
  }

  // Criar usuário usando a anon key (envia e-mail de confirmação normalmente)
  const anon = createClient(supabaseUrl, anonKey ?? serviceKey, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signUp({ email, password });

  if (error) {
    const msg = error.message.includes("already registered")
      ? "Este e-mail já está cadastrado."
      : error.message;
    return res.status(400).json({ error: msg });
  }

  // Registrar IP após cadastro bem-sucedido
  if (ip !== "unknown" && data.user) {
    await admin.from("ip_registrations").insert({ ip, user_id: data.user.id });
    await admin.from("profiles").upsert({ id: data.user.id, email });
  }

  return res.status(200).json({ success: true });
}
