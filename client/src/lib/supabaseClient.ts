import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const authEnabledOnClient = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!authEnabledOnClient) return null;
  if (client) return client;
  client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  if (!authEnabledOnClient) return null;
  const c = getSupabaseClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut(): Promise<void> {
  const c = getSupabaseClient();
  if (!c) return;
  await c.auth.signOut();
}


