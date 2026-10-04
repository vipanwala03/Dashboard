@AGENTS.md

# Dashboard App

Personal dashboard: Google Calendar + Google Tasks + quick notes, with Claude-generated
suggestions tying them together. This is a first vibecoding project, built phase by phase
(each phase has a checkpoint before the next one starts). The original planning doc is at
https://claude.ai/code/artifact/7e37fdfe-44cb-47f9-9f71-1ed535254156 (read-only reference
from an earlier Cowork session) — the roadmap status below is the living summary.

## Stack

- Next.js 16 (App Router, Turbopack, TypeScript, Tailwind v4). Next 16 has real breaking
  changes from older training data — `middleware.ts` was renamed to `src/proxy.ts`
  (`export function proxy(request)` instead of `export function middleware(request)`).
  Check `node_modules/next/dist/docs/` before assuming anything else carried over.
- Supabase (Postgres + Auth) — project ref `tmiajpdhedymuwfwnbrv`, project name
  `dashboard-app`. Auth is Supabase Auth with Google as the only sign-in provider.
  Site URL / Redirect URLs are set in the Supabase dashboard under Authentication → URL
  Configuration — if that allow-list doesn't include the live Vercel URL, Google sign-in
  silently redirects to `localhost:3000` instead of failing loudly (bit us once already).
- Vercel — project `dashboard-app`, auto-deploys `main` to
  https://dashboard-app-beta-plum.vercel.app.
- GitHub — vipanwala03/Dashboard, `main` branch.

## Auth architecture

- `src/lib/supabase/{client,server}.ts` — browser/server Supabase clients (`@supabase/ssr`).
- `src/proxy.ts` + `src/lib/supabase/middleware.ts` — refreshes the session cookie on every
  request.
- `src/app/auth/callback/route.ts` — exchanges the OAuth code for a session, and captures
  Google's `provider_token`/`provider_refresh_token` into the `google_tokens` table
  (RLS-scoped to the signed-in user) so Calendar/Tasks API calls won't need the user to
  sign in again later.
- Google OAuth already requests the `.../auth/calendar` and `.../auth/tasks` scopes up
  front (see `src/components/sign-in-button.tsx`) — deliberate, to avoid a second consent
  round-trip in Phase 3/4.
- `/` shows a sign-in button when logged out and redirects to `/dashboard` when logged in;
  `/dashboard` does the reverse.

## Roadmap status

- [x] Phase 0 — accounts/tools ready
- [x] Phase 1 — scaffolded, deployed, auto-deploy wired up
- [x] Phase 2 — Supabase DB + Google sign-in via Supabase Auth (verified working end to end)
- [x] Phase 3 — Calendar integration. `src/lib/google/tokens.ts` returns a valid access
      token (refreshing via Google's token endpoint when expired), `src/lib/google/calendar.ts`
      fetches the primary calendar's next 14 days, `/dashboard` renders them grouped by day in
      the calendar's own time zone (Vercel servers run in UTC).
- [x] Phase 4 — Google Tasks to-do list. `src/lib/google/tasks.ts` lists open tasks on the
      default list (subtasks nested) and adds/completes them via Server Actions in
      `src/app/dashboard/actions.ts`. All Google REST calls go through
      `src/lib/google/fetch.ts` (401 → `GoogleReauthRequiredError` → "Reconnect Google").
- [ ] Phase 5 — Quick notes + Web Speech API voice input, saved to the `notes` table (next up)
- [ ] Phase 6 — Combined dashboard home screen
- [ ] Phase 7 — AI suggestions (Claude API reads a note + calendar/tasks context, proposes
      a next step)
- [ ] Phase 8 — PWA / installable
- [ ] Phase 9 (optional) — native App Store wrap via Capacitor

## Database

- `notes`, `suggestions` — RLS enabled, no policies yet beyond lockdown; add user-scoped
  policies when Phase 5/7 need real reads/writes.
- `google_tokens` — one row per user, RLS-scoped to `auth.uid() = user_id`, holds Google's
  `access_token` / `refresh_token` / `expires_at`.

## Local dev

- `.env.local` (gitignored) needs `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — pull both from the Supabase MCP server
  (`get_project_url` / `get_publishable_keys` with project ref `tmiajpdhedymuwfwnbrv`) once
  it's connected, or from the Supabase dashboard under Project Settings → API.
- It also needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (the same OAuth client Supabase's
  Google provider uses) to refresh Google access tokens. Both are set in Vercel too; the
  secret is a "sensitive" var there, so it can't be read back — get it from Google Cloud
  Console → Credentials if `.env.local` is lost.
- Signing in on the Vercel site doesn't sign you in on `localhost` — sign in again locally.
- Run `npm run build` once after deleting `.next` before trusting a bare `tsc --noEmit` —
  Next 16 regenerates ambient types (`LayoutProps` etc.) during build, so a fresh `tsc`
  run right after wiping `.next` throws a false `Cannot find name 'LayoutProps'`.
- `npm run build` and `npm run lint` should both be clean before committing.

## MCP servers

Supabase, Vercel, and GitHub are configured as project MCP servers in `.mcp.json`
(checked into the repo — no secrets in it, just server URLs). Run `/mcp` inside a `claude`
session started in this directory to authenticate each one (one-time OAuth per service,
browser-based). Once authenticated, manage the Supabase database/migrations, Vercel
deployments/env vars, and the GitHub repo directly from here, the same way earlier phases
were built from Cowork.
