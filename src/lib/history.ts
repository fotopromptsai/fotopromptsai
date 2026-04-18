import { supabaseDb } from "@/src/lib/supabaseDb";

export interface Generation {
  id: string;
  prompt: string;
  result_image_url: string | null;
  created_at: string;
}

export async function saveGeneration(userId: string, prompt: string, resultImageUrl: string | null) {
  await supabaseDb.from("generations").insert({
    user_id: userId,
    prompt,
    result_image_url: resultImageUrl,
  });
}

export async function fetchHistory(userId: string): Promise<Generation[]> {
  const { data } = await supabaseDb
    .from("generations")
    .select("id, prompt, result_image_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as Generation[];
}
