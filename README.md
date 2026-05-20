# Trackla

## Deployment note (Render)

This app encrypts sensitive subscription fields (e.g., `serviceName`, `amount`) at rest.

- Set `ENCRYPTION_KEY` in your Render service environment variables.
- Keep the same value across deploys. If you change it, previously-encrypted data cannot be decrypted (and you will see encrypted strings / `$NaN` in the UI).

If you accidentally rotated the key but still know the old value, you can keep production working by setting:

- `ENCRYPTION_KEY` = current/new key (used for new writes)
- `ENCRYPTION_KEY_FALLBACKS` = old key(s), comma-separated (used only for reads/decryption)

Also ensure the key is pasted without surrounding quotes and without trailing spaces.

If `ENCRYPTION_KEY` is missing in hosted production, the server will refuse to start to prevent silent data corruption / unreadable UI.

## Google OAuth (Login)

The frontend Login/Signup pages redirect to `GET /api/auth/google/start`.

### 1) Google Cloud Console settings

Create an **OAuth Client ID** (Application type: **Web application**), then configure:

- **Authorized JavaScript origins**
	- Local: `http://localhost:5173`
	- Render (same-domain app): `https://subscription-management-6uje.onrender.com`

- **Authorized redirect URIs**
	- Local backend callback: `http://localhost:5000/api/auth/google/callback`
	- Render backend callback: `https://subscription-management-6uje.onrender.com/api/auth/google/callback`

### 2) Server environment variables

Set these env vars (see `.env.example`):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional (recommended if you ever host backend behind a custom domain):

- `PUBLIC_BASE_URL` (e.g. `https://your-domain.com`)
- `FRONTEND_URL` (only if frontend is hosted separately)

### Notes

- Current implementation signs in **existing accounts** by matching Google email to an existing user record.
- If no account exists for that email, the callback starts the onboarding flow (sets a short-lived `google_onboarding` cookie) and redirects to `/auth?google=onboarding`.
- During onboarding, the user sets a password (stored as a bcrypt hash) so they can later log in either with Google or manually using email + password.
