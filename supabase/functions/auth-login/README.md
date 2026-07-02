# Edge Function: `auth-login`

Pre-auth login endpoint. Verifies a PIN via the existing `login_with_pin` RPC
(bcrypt + IP rate limiting) and returns a signed JWT the frontend uses as its
Supabase session. This is step 1 of the auth-jwt-hardening change; the client
does not use it yet (that is PR2).

## What it returns

```json
{ "token": "<signed JWT, HS256>", "employee": { ...employee fields... } }
```

Errors: `400 missing_pin` / `401 invalid_pin` / `429 rate_limited` / `500 server_*`.

The JWT claims: `sub`, `role: "authenticated"`, `aud: "authenticated"`,
`employee_id`, `is_admin`, `is_master`, `admin_id`, `exp` (+8h). RLS reads these
via `auth.jwt() ->> 'employee_id'` etc. (added in PR3).

## Deploy (run these once)

Prereqs: Supabase CLI installed and project linked
(`supabase link --project-ref <your-ref>`).

1. **Set the signing secret** — must be the project's JWT secret so PostgREST
   accepts the tokens. Dashboard → Project Settings → API → **JWT Secret**:

   ```bash
   supabase secrets set JWT_SECRET="<paste the JWT Secret here>"
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
   do not set them.

2. **Disable JWT verification for this function** (it is the login endpoint, so
   callers have no token yet). Add to `supabase/config.toml`:

   ```toml
   [functions.auth-login]
   verify_jwt = false
   ```

   (Older CLIs: deploy with `--no-verify-jwt` instead.)

3. **Deploy**:

   ```bash
   supabase functions deploy auth-login
   ```

## Test

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/auth-login" \
  -H "apikey: <anon key>" \
  -H "Content-Type: application/json" \
  -d '{"pin":"<a real pin>"}'
```

Expect `200` with `token` + `employee`. A wrong PIN → `401`. Six wrong PINs from
the same IP within 15 min → `429 rate_limited`.
