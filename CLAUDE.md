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
- [x] Phase 5 — Quick notes + Web Speech API voice input. `src/components/note-composer.tsx`
      (client; Dictate button hidden where the browser lacks SpeechRecognition, e.g. Firefox)
      saves through `addNoteAction`; `src/lib/notes.ts` lists the 20 most recent.
- [x] Phase 6 — Combined dashboard home screen: greeting, "At a glance" tiles
      (`src/components/at-a-glance.tsx`), then This week | To-do | Notes columns (stacked
      on phones). Calendar now merges every calendar switched on in Google Calendar over the
      next 7 days; tasks sort by due date.
- [x] Redesign (between Phases 6 and 7) — dark navy/cyan theme (tokens in
      `src/app/globals.css`, shared pieces in `src/components/ui.tsx`, Geist via next/font).
      Notes | To-do | AI planner panels above a Google-Calendar-style time grid
      (`src/components/week-view.tsx`, layout math in `src/lib/week-layout.ts`): Day / 3 days /
      Week (auto: 3 days on phones, week from `md`), `?start=YYYY-MM-DD` navigation, a
      12-hour window that follows the clock within the hours that have events. Tasks can be
      dictated (`src/lib/use-dictation.ts`, shared with notes). The AI planner panel is a
      disabled placeholder. Preview mockup: https://claude.ai/artifact/R37Lpm5jzuhCzhwQB4NFgz
- [x] Phase 7 — AI suggestions (built; awaiting the user's signed-in checkpoint test).
      On demand, not automatic: the AI planner panel's ask box (typed or dictated) and a
      "Plan this" link on each note call `askPlannerAction` (`src/app/dashboard/actions.ts`),
      which sends the request/note + next 7 days of events + open tasks to Claude
      (`src/lib/ai/planner.ts`, model `claude-sonnet-5-5`, structured JSON output, server-side
      refusal fallbacks). Claude writes wall-clock times in the calendar's zone; the server
      converts (`zonedTimeToDate`) and drops anything malformed, past, too long, or
      overlapping an existing event. Proposals are stored as `pending` rows in `suggestions`
      and drawn as dashed "Suggested" blocks in the week view. "Add to calendar" creates the
      event on the primary Google calendar (`createCalendarEvent`); "Dismiss" hides it.
      Suggestions never touch Google until accepted. Tasks stay in Google Tasks (they only
      hold due dates), so a scheduled task becomes a Calendar event.
      Email (same ask box): when the request is to write/send an email, the same Claude
      call returns a draft instead of calendar proposals. The panel shows an editable
      To/Subject/Message preview; only "Send email" (`sendEmailAction` →
      `src/lib/google/gmail.ts`, scope `gmail.send`, send-only) sends it, and the recipient
      must be typed/dictated by the user — Claude never guesses addresses. Needs the Gmail
      API enabled in Google Cloud, the scope on the OAuth consent screen, and a fresh
      sign-in to grant it.
      Deleting events: clicking any calendar event opens `src/components/event-dialog.tsx`
      (details + Open in Google + two-step Delete); the ask box also understands "delete my
      study block tomorrow" and shows a confirm card first. Both call `deleteEventsAction` →
      `deleteCalendarEvent` (a recurring event deletes just that occurrence). Events on
      read-only calendars (`accessRole` not owner/writer) can't be deleted. The AI only sees
      the next 7 days, and it never deletes without the confirm click.
- [ ] Phase 8 — PWA / installable
- [ ] Phase 9 (optional) — native App Store wrap via Capacitor

## Database

- `notes` — `user_id` defaults to `auth.uid()` (so inserts don't send it); RLS policies
  allow the owner to select/insert/delete. `source` is checked to be `text` or `voice`.
- `suggestions` — one proposed calendar event: `user_id` (defaults to `auth.uid()`),
  `title`, `start_at`, `end_at`, `reason`, `status` (`pending`/`accepted`/`dismissed`),
  optional `note_id` (the note it came from), `calendar_event_id` once accepted. Owner-only
  RLS for select/insert/update/delete.
- `ai_usage` — one row per Claude call (`user_id`, `created_at`, `input_tokens`,
  `output_tokens`); owner-only select/insert, no update/delete. Drives the daily cap
  (`DAILY_LIMIT` = 50 requests per rolling 24 hours, checked in `askPlannerAction` before any
  call) and the usage line in the AI tile (`src/lib/ai/usage.ts`; cost is an estimate at
  Sonnet 5.5 list price, $2 / $10 per million input / output tokens).
- `google_tokens` — one row per user, RLS-scoped to `auth.uid() = user_id`, holds Google's
  `access_token` / `refresh_token` / `expires_at`.

## Local dev

- `.env.local` (gitignored) needs `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — pull both from the Supabase MCP server
  (`get_project_url` / `get_publishable_keys` with project ref `tmiajpdhedymuwfwnbrv`) once
  it's connected, or from the Supabase dashboard under Project Settings → API.
- `ANTHROPIC_API_KEY` powers the AI planner (set in `.env.local` and in Vercel for
  production + preview).
- It also needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (the same OAuth client Supabase's
  Google provider uses) to refresh Google access tokens. Both are set in Vercel too; the
  secret is a "sensitive" var there, so it can't be read back — get it from Google Cloud
  Console → Credentials if `.env.local` is lost.
- Signing in on the Vercel site doesn't sign you in on `localhost` — sign in again locally.
- `~/Documents` is iCloud-synced; iCloud has created " 2" duplicate files inside
  `node_modules`/`.next`, which breaks `tsc` (`Cannot find type definition file for 'node 2'`).
  Fix: `rm -rf node_modules .next && npm ci`.
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
