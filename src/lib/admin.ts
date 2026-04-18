import { supabaseDb } from "@/src/lib/supabaseDb";

export const COST_ANALYZE = 0.02;
export const COST_GENERATE = 0.01;
export const LOVABLE_BUDGET = 1.00;

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  credits: number;
  last_reset: string | null;
}

export interface AdminLog {
  id: string;
  user_id: string;
  email: string;
  prompt: string;
  result_image_url: string | null;
  created_at: string;
}

export interface UsageStat {
  lovable_url: string;
  analyze_count: number;
  generate_count: number;
  total_cost: number;
  date: string;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const [{ data: profiles }, { data: credits }] = await Promise.all([
    supabaseDb.from("profiles").select("id, email, created_at").order("created_at", { ascending: false }),
    supabaseDb.from("user_credits").select("user_id, credits, last_reset"),
  ]);

  if (!profiles) return [];

  return profiles.map((p) => {
    const c = credits?.find((c) => c.user_id === p.id);
    return {
      id: p.id,
      email: p.email,
      created_at: p.created_at,
      credits: c?.credits ?? 0,
      last_reset: c?.last_reset ?? null,
    };
  });
}

export async function fetchAdminLogs(): Promise<AdminLog[]> {
  const [{ data: generations }, { data: profiles }] = await Promise.all([
    supabaseDb.from("generations").select("id, user_id, prompt, result_image_url, created_at").order("created_at", { ascending: false }).limit(50),
    supabaseDb.from("profiles").select("id, email"),
  ]);

  if (!generations) return [];

  return generations.map((g) => ({
    id: g.id,
    user_id: g.user_id,
    email: profiles?.find((p) => p.id === g.user_id)?.email ?? g.user_id.slice(0, 8),
    prompt: g.prompt,
    result_image_url: g.result_image_url,
    created_at: g.created_at,
  }));
}

export async function fetchUsageStats(): Promise<UsageStat[]> {
  const { data } = await supabaseDb
    .from("api_calls")
    .select("call_type, cost, lovable_url, created_at")
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  // Agrupa por projeto (lovable_url)
  const grouped: Record<string, UsageStat> = {};
  for (const row of data) {
    const key = row.lovable_url ?? "desconhecido";
    if (!grouped[key]) {
      grouped[key] = {
        lovable_url: key,
        analyze_count: 0,
        generate_count: 0,
        total_cost: 0,
        date: row.created_at,
      };
    }
    if (row.call_type === "analyze") grouped[key].analyze_count++;
    if (row.call_type === "generate") grouped[key].generate_count++;
    grouped[key].total_cost += row.cost;
  }

  return Object.values(grouped).sort((a, b) => b.total_cost - a.total_cost);
}

export async function trackApiCall(
  userId: string,
  callType: "analyze" | "generate",
  lovableUrl: string
): Promise<void> {
  const cost = callType === "analyze" ? COST_ANALYZE : COST_GENERATE;
  await supabaseDb.from("api_calls").insert({
    user_id: userId,
    call_type: callType,
    cost,
    lovable_url: lovableUrl,
  });
}

export async function setUserCredits(userId: string, credits: number): Promise<boolean> {
  const { error } = await supabaseDb
    .from("user_credits")
    .upsert({ user_id: userId, credits, last_reset: new Date().toISOString() });
  return !error;
}
