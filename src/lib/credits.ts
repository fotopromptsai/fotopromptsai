import { supabaseDb } from "@/src/lib/supabaseDb";

const CREDITS_PER_RESET = 6;
const RESET_HOURS = 24;

export type CreditInfo = { credits: number; nextReset: Date };

export async function getOrInitCredits(userId: string): Promise<CreditInfo> {
  const { data, error } = await supabaseDb
    .from("user_credits")
    .select("credits, last_reset")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Primeira vez — cria registro
    await supabaseDb.from("user_credits").insert({
      user_id: userId,
      credits: CREDITS_PER_RESET,
      last_reset: new Date().toISOString(),
    });
    const nextReset = new Date();
    nextReset.setHours(nextReset.getHours() + RESET_HOURS);
    return { credits: CREDITS_PER_RESET, nextReset };
  }

  const lastReset = new Date(data.last_reset);
  const hoursSince = (Date.now() - lastReset.getTime()) / 1000 / 3600;
  const nextReset = new Date(lastReset.getTime() + RESET_HOURS * 3600 * 1000);

  if (hoursSince >= RESET_HOURS) {
    // Reseta créditos
    const now = new Date().toISOString();
    await supabaseDb
      .from("user_credits")
      .update({ credits: CREDITS_PER_RESET, last_reset: now })
      .eq("user_id", userId);
    const newNext = new Date();
    newNext.setHours(newNext.getHours() + RESET_HOURS);
    return { credits: CREDITS_PER_RESET, nextReset: newNext };
  }

  return { credits: data.credits, nextReset };
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
