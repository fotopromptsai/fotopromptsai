import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_DB_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_DB_SUPABASE_ANON_KEY as string;

export const supabaseDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
