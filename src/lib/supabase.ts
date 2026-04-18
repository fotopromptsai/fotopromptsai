import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export const getLovableClient = () => _client;

export function initLovableClient(url: string, key: string) {
  _client = createClient(url, key);
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_client) throw new Error("Cliente Lovable não inicializado. Verifique as configurações.");
    return (_client as any)[prop];
  },
});
