// Edge Function: auth-login
//
// Verifies a PIN using the existing SECURITY DEFINER `login_with_pin` RPC
// (which does the bcrypt check and IP-based rate limiting), then mints a
// short-lived JWT signed with the project's JWT secret. PostgREST accepts
// this token (same secret + "role" claim), so RLS policies can read the
// custom claims via auth.jwt().
//
// Deploy with verify_jwt DISABLED (this is the pre-auth login endpoint):
//   supabase functions deploy auth-login --no-verify-jwt
// And set the signing secret:
//   supabase secrets set JWT_SECRET="<Project Settings -> API -> JWT Secret>"

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Master admin is identified by this invite code (see existing app logic).
const MASTER_INVITE = "CORP-18EC";
// Access-token lifetime. On expiry the user simply logs in again with the PIN
// (no refresh flow to keep the surface small).
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Import the HMAC signing key once at cold start.
const signingKey = JWT_SECRET
  ? await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
  : null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!signingKey || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Misconfiguration: secret or platform env not set.
    return json({ error: "server_misconfigured" }, 500);
  }

  let pin: unknown;
  try {
    ({ pin } = await req.json());
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (typeof pin !== "string" || pin.length === 0) {
    return json({ error: "missing_pin" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")[0]
    .trim() || null;
  const ua = req.headers.get("user-agent") ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // login_with_pin(p_pin, p_ip, p_ua): does bcrypt check + rate limiting and
  // returns the employee json, or { error: 'rate_limited' }, or null.
  const { data, error } = await admin.rpc("login_with_pin", {
    p_pin: pin,
    p_ip: ip,
    p_ua: ua,
  });

  if (error) {
    return json({ error: "server_error" }, 500);
  }
  if (!data) {
    return json({ error: "invalid_pin" }, 401);
  }
  // deno-lint-ignore no-explicit-any
  const emp = data as any;
  if (emp.error === "rate_limited") {
    return json({ error: "rate_limited", message: emp.message }, 429);
  }

  const isMaster = emp.invite_code === MASTER_INVITE;
  const isAdmin = emp.role === "admin" || isMaster;

  const payload = {
    sub: String(emp.id),
    role: "authenticated",
    aud: "authenticated",
    employee_id: String(emp.id),
    is_admin: isAdmin,
    is_master: isMaster,
    admin_id: emp.admin_id ?? null,
    iat: getNumericDate(0),
    exp: getNumericDate(TOKEN_TTL_SECONDS),
  };

  const token = await create({ alg: "HS256", typ: "JWT" }, payload, signingKey);

  return json({ token, employee: emp }, 200);
});
