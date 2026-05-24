# Waryt CRM

Next.js **16** + Supabase CRM forked from the Dala Hub feature set, rebranded for **Waryt** (blue theme, wordmark in `public/waryt-mark.svg`), with **PWA** (`public/manifest.webmanifest`, `public/sw.js`), **Docker-friendly** env vars, and **i18n** (English, አማርኛ, Afaan Oromoo) via `next-intl` with a shell language switcher.

## Features

- Supabase Auth: **Google OAuth** (no hosted-domain lock) and **email magic link** (`signInWithOtp`) on the login screen.
- Optional **allowlist** (set either or both — leave unset to allow all Google accounts that pass Supabase):
  - `NEXT_PUBLIC_WARYT_ALLOWED_EMAILS` — comma-separated full addresses.
  - `NEXT_PUBLIC_WARYT_ALLOWED_EMAIL_DOMAINS` — comma-separated domains (e.g. `waryt.com,example.org`).
- Sales workspace (pipeline, prospects, performance, insights, alerts, reporting, sales log, challenges), admin, teams, people, reports, settings.

## Environment

Copy `.env.example` to `.env.local` and fill values. **Never commit** `.env.local` or service keys.

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_BASE_URL` | Recommended in Docker / reverse proxies | Canonical site URL, e.g. `https://crm.example.com` (no trailing slash). Used by auth redirects. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon / publishable key |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Optional | Node (server) mirror if `NEXT_PUBLIC_*` is not visible during SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | Local scripts / CI only | Never expose to the browser |
| `NEXT_PUBLIC_ETB_PER_USD` | Optional | Default `155` for ETB entry helpers |
| `NEXT_PUBLIC_WARYT_ALLOWED_EMAILS` | Optional | Google allowlist |
| `NEXT_PUBLIC_WARYT_ALLOWED_EMAIL_DOMAINS` | Optional | Google domain allowlist |

## Supabase

1. Create a **new** Supabase project.
2. From the repo root: `supabase link` then `supabase db push` (or apply SQL from `supabase/migrations/` in order in the SQL editor).
3. **Do not** deploy the removed Vusi edge functions (`vusi-create`, `vusi-update`, `vusi-resolve-user`); those assets and the `vusi_resolve_user_by_email` migration are omitted from this tree.
4. Enable **Google** and **Email** providers in Authentication → Providers; set Site URL / redirect URLs to `${NEXT_PUBLIC_BASE_URL}/auth/callback` (and local `http://localhost:3000/auth/callback` for dev).

## Docker

Build args (see `Dockerfile`): `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optional legacy `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` if your project uses it). Output is Next **standalone** for a slim runtime image.

## i18n

- Messages live under `messages/{en,am,om}/` as JSON shards merged in `i18n/request.ts`.
- Locale cookie: `NEXT_LOCALE` (`en` \| `am` \| `om`), default `en`.
- Add or adjust keys in all three locales when changing UI copy.

## Development

```bash
npm install
npm run dev
```

## License

Private / as per your organization.
