import { supabaseDb } from "@/src/lib/supabaseDb";

const INITIAL_CREDITS = 6;

export type CreditInfo = { credits: number };

export async function getOrInitCredits(userId: string): Promise<CreditInfo> {
  const { data, error } = await supabaseDb
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    await supabaseDb.from("user_credits").insert({
      user_id: userId,
      credits: INITIAL_CREDITS,
      last_reset: new Date().toISOString(),
    });
    return { credits: INITIAL_CREDITS };
  }

  return { credits: data.credits };
}

export async function consumeCredit(userId: string): Promise<boolean> {
  const { credits } = await getOrInitCredits(userId);
  if (credits <= 0) return false;

  await supabaseDb
    .from("user_credits")
    .update({ credits: credits - 1 })
    .eq("user_id", userId);

  return true;
}
