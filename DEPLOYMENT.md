# Deployment — Google Cloud Run

The application is full-stack (React + Node/Express), so it must not be deployed as a static GitHub Pages site.

## Recommended target
Google Cloud Run in the same Google Cloud/Firebase project used by the application.

## Required runtime configuration
- `ATLAS_API_KEY`
- `WAVESPEED_API_KEY`
- `ADMIN_BOOTSTRAP_SECRET`
- `ASSET_STREAM_SECRET`
- `APP_URL` (set to the final Cloud Run HTTPS URL after the first deployment)
- `GEMINI_API_KEY` if Prompt Improve is enabled

## Optional payment configuration
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_BASE_URL=https://api.mercadopago.com`

Without Mercado Pago credentials, online top-ups remain unavailable; admin credits can be used for internal testing.

## Google permissions
The Cloud Run service account needs access to the project's Firestore and Firebase/Cloud Storage bucket. Do not store service-account JSON files in the repository.

## Post-deploy checks
1. `/health` returns HTTP 200.
2. Login works and an authenticated user can open Create.
3. Upload a small JPG; it must persist in Assets after refresh.
4. Admin credits a small test balance.
5. Create a low-cost generation; verify wallet reserve, provider submit, polling, final capture/release, and History.
6. Only after these checks enable payment credentials/webhook.
