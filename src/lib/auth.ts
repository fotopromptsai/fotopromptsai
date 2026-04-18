import { supabaseDb } from "@/src/lib/supabaseDb";

export async function signUp(email: string, password: string) {
  const { data, error } = await supabaseDb.auth.signUp({ email, password });
  if (!error && data.user) {
    await supabaseDb.from("profiles").upsert({ id: data.user.id, email });
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseDb.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabaseDb.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data, error } = await supabaseDb.auth.getSession();
  return { session: data.session, error };
}
