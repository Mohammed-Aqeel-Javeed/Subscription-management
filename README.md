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
