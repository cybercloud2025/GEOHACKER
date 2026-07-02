import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase environment variables. Please check .env file.');
}

// Holds the app JWT minted by the `auth-login` edge function. While set, every
// Supabase request is sent as this authenticated user so RLS can enforce
// per-user/role access; when null we fall back to the anon key. The auth store
// updates this on login / logout / rehydrate.
let currentAccessToken: string | null = null;
export function setSupabaseAccessToken(token: string | null) {
    currentAccessToken = token;
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        // Custom JWT auth (PIN login via edge function). Returning the anon key
        // when logged out keeps anonymous requests working as role `anon`.
        accessToken: async () => currentAccessToken ?? (supabaseAnonKey || ''),
    }
);
