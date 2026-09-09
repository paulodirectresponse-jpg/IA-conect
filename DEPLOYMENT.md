# Deployment — Cloudflare Workers

The production target is Cloudflare Workers with the official Cloudflare Vite plugin. The React SPA and the Express API are deployed together from the same GitHub repository.

## Automatic deployment flow

GitHub `main` -> Cloudflare Builds -> `npm install` -> `npm run build` -> `npx wrangler deploy` -> `*.workers.dev`.

No Google AI Studio step is required.

## Cloudflare project settings

- Repository: `paulodirectresponse-jpg/IA-conect`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root
- Node version: 22+ (Cloudflare currently defaults to Node 24 for Builds)

`wrangler.jsonc` is committed and controls the Worker entrypoint, SPA fallback and non-secret provider base URLs.

## Required encrypted secrets

Configure these in Cloudflare Workers > Settings > Variables and Secrets. Do not commit values to GitHub.

- `FIREBASE_SERVICE_ACCOUNT_JSON` — complete Firebase/Google service-account JSON. Required because Cloudflare does not provide Google Application Default Credentials.
- `ATLAS_API_KEY`
- `WAVESPEED_API_KEY`
- `ADMIN_BOOTSTRAP_SECRET`
- `ASSET_STREAM_SECRET`

Optional:

- `INITIAL_ADMIN_EMAIL`
- `GEMINI_API_KEY` — required only while Prompt Improve is enabled.
- `APP_URL` — normally unnecessary because reference URLs derive the incoming request host. It can be set to the final `https://<worker>.<subdomain>.workers.dev` URL if desired.

Payments stay disabled until these are configured:

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`

Non-secret base URLs already live in `wrangler.jsonc`.

## Firebase compatibility on Workers

The backend uses the official Firebase Admin SDK. Firestore is explicitly initialized with `preferRest: true`, so queries and transactions use HTTP/1.1 REST instead of gRPC. The service account is loaded from the encrypted Worker secret.

Firebase Auth token verification, Firestore and Cloud Storage remain the system of record; Cloudflare only hosts the application/API.

## Asset upload note

Cloudflare Free accounts accept request bodies up to 100 MB. The current backend upload route therefore works for normal reference images/audio and smaller video references. Large-video direct uploads should later move to a signed direct-to-storage upload flow instead of passing through the Worker.

## First deployment acceptance test

1. Open `/health` and confirm HTTP 200.
2. Login with the existing Firebase account.
3. Upload a small JPG and confirm it remains in Assets after refresh.
4. Add admin test credit.
5. Open Create and verify model pricing.
6. Submit one low-cost generation.
7. Verify reserve -> provider submit -> polling -> capture/release -> History.
8. Confirm a referenced asset is reachable by the selected provider.
9. Only after these tests configure Mercado Pago.

## Future updates

Once the Cloudflare Git integration is connected, every push to `main` automatically builds and publishes a new Worker version. No domain configuration is required while using the free `workers.dev` URL.
