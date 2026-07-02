// CORS headers for the auth-login edge function.
// Origin is permissive because this is a pre-auth login endpoint that uses no
// cookies; tighten to "https://geohacker.app" if you want to restrict callers.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
