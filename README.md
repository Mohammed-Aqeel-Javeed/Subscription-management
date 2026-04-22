# Trackla

## Deployment note (Render)

This app encrypts sensitive subscription fields (e.g., `serviceName`, `amount`) at rest.

- Set `ENCRYPTION_KEY` in your Render service environment variables.
- Keep the same value across deploys. If you change it, previously-encrypted data cannot be decrypted (and you will see encrypted strings / `$NaN` in the UI).

If `ENCRYPTION_KEY` is missing in hosted production, the server will refuse to start to prevent silent data corruption / unreadable UI.
