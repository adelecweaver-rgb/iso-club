# Iso Club Portal

Iso Club Portal is a Next.js App Router application for member and coach operations:

- Clerk authentication and protected routes
- Supabase-backed member data, training logs, protocols, and messaging
- Member dashboard and tools (recovery self-log, AI photo data upload, settings)
- Coach APIs for logging sessions, scoring healthspan, and creating protocols
- Twilio SMS automation (welcome, protocol ready, scan results, reminders, weekly summaries, low recovery alerts)

This README is written for developer onboarding.

---

## 1) Software stack

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- CSS from prototype design files + component-level styles

### Auth
- **Clerk** (`@clerk/nextjs`)
- Middleware/proxy protection with role-based redirects

### Data
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`)
- Server client + admin client patterns

### AI + Integrations
- **Anthropic Claude** vision extraction (`claude-sonnet-4-20250514`)
- **Twilio** for outbound SMS
- **Vercel Cron** for scheduled SMS checks

### Tooling
- ESLint (`eslint`, `eslint-config-next`)
- `npm run lint`, `npm run build` as the main quality gates

---

## 2) High-level architecture

### Request flow
1. User signs in via Clerk.
2. App resolves role and onboarding state from Supabase (`users` table).
3. Route guard redirects:
   - member -> `/dashboard`
   - coach/admin -> `/coach`
   - staff -> `/coach/log`
4. Dashboard/API operations read and write Supabase data.

### App structure
- `app/` - routes, API routes, auth screens
- `components/` - React UI components and forms
- `lib/server/` - server-side auth/role/sms/prototype helpers
- `lib/supabase/` - browser/server/admin Supabase clients

### Auth + role helpers
- `lib/server/clerk.ts` - safe auth wrappers and "configured?" checks
- `lib/server/roles.ts` - `getCurrentAuthState`, `routeForRole`
- `lib/server/actor.ts` - authenticated actor context for API routes

### Data access pattern
- Use `createSupabaseAdminClient()` for privileged writes/reads (service role)
- Use `createSupabaseServerClient()` for request-scoped server work
- Use `createSupabaseBrowserClient()` only in client code where needed

---

## 3) Routes overview

### Public/auth pages
- `/` - landing page
- `/sign-in` - Clerk SignIn
- `/sign-up` - Clerk SignUp

### Member pages
- `/onboarding`
- `/dashboard`
- `/dashboard/[section]` (dashboard, protocol, carol, arx, scans, recovery, wearables, messages, reports, schedule)
- `/dashboard/recovery` - recovery self-log
- `/dashboard/upload` - AI image upload + extraction flow
- `/dashboard/settings` - profile + notification preferences

### Coach pages
- `/coach`
- `/coach/[section]`
- `/coach/log` - staff log prototype route
- `/coach/protocols` - protocol builder prototype route
- `/coach/capture` - AI capture prototype route

---

## 4) API endpoints

### Auth/user provisioning
- `POST /api/webhooks/clerk` - Clerk -> Supabase user sync
- `POST /api/onboarding/complete` - member onboarding write + optional welcome SMS

### Messaging
- `GET /api/messages/inbox` - member inbox thread + unread count
- `POST /api/messages/send` - send message to coach/member

### Coach write endpoints
- `POST /api/coach/log-session`
- `POST /api/coach/healthspan`
- `POST /api/coach/protocols`
- `POST /api/coach/members/contact`

### Member write endpoints
- `POST /api/recovery/log`
- `POST /api/member/upload-data`
- `GET/POST /api/member/settings`

### AI extraction
- `POST /api/ai/extract-machine-data`

### Automation
- `GET/POST /api/cron/sms` - Twilio automation orchestrator (auth protected by secret)

---

## 5) Core feature set

### Authentication and RBAC
- Clerk handles identity and sessions.
- Supabase `users.role` is the source of truth for app role.
- Middleware/proxy protects non-public pages and API routes.

### Member dashboard
- React-based interactive dashboard (`components/dashboard-react-client.tsx`)
- Navigation state controlled in React with `useState`
- Real data from Supabase:
  - CAROL/ARX sessions
  - Fit3D scan stats
  - wearables snapshot
  - healthspan scores
  - protocol + sessions
  - bookings/reports
- Member messaging thread with coach (live fetch + send)

### Coach operations
- Session logging endpoint supports ARX/CAROL/Fit3D/wearables/manual/recovery modalities
- Healthspan score updates
- Protocol creation with protocol session rows
- Member phone updates for SMS eligibility

### Recovery + Upload tools
- Member recovery self-log saves to `recovery_sessions`
- Member upload flow:
  1. Upload image
  2. Claude extracts JSON
  3. Member can edit JSON
  4. Save to machine/wearable tables

### SMS automation
- Twilio transport + templated messages + `sms_log` persistence
- Preference-aware sends (`member_notification_preferences`)
- Scheduled and event-based triggers:
  - welcome
  - protocol ready
  - scan results
  - session reminder
  - weekly summary
  - low recovery flag

---

## 6) Environment variables

Copy `.env.example` -> `.env.local`.

### Required
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)

### Required for SMS and AI features
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SMS_CRON_SECRET`
- `ISO_CLUB_TIMEZONE` (default `America/Chicago`)
- `ANTHROPIC_KEY` (or `ANTHROPIC_API_KEY`)

### Recommended / situational
- `CLERK_WEBHOOK_SIGNING_SECRET` (for Clerk webhook verification in production)
- Clerk redirect hints:
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard`

---

## 7) Database expectations (Supabase)

The app expects these tables (minimum):

- `users`
- `messages`
- `bookings`
- `protocols`
- `protocol_sessions`
- `healthspan_scores`
- `carol_sessions`
- `arx_sessions`
- `fit3d_scans`
- `wearable_data`
- `manual_workout_sessions`
- `recovery_sessions`
- `reports`
- `sms_log`
- `member_notification_preferences`
- `session_notes`

If schema columns differ, some endpoints include graceful fallbacks (for example optional `read_at`, `dustin_reviewed`, or `logged_by` handling).

---

## 8) Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://localhost:3000`

Quality checks:

```bash
npm run lint
npm run build
```

---

## 9) Deployment (Vercel)

1. Import repo in Vercel.
2. Add env vars from section 6.
3. Ensure cron is enabled (see `vercel.json`):
   - `/api/cron/sms` every 30 minutes.
4. Deploy.

Important:
- Service role key must be present for onboarding/webhooks/admin writes.
- Missing Clerk keys will cause auth routes to render fallback config warnings.

---

## 10) Development conventions (important)

### Interactive pages rule
For any page with click handlers, view switching, or dynamic interactions:

- Build as **proper React components**
- Use **`useState`/hooks** for state
- Use **React `onClick` props** for click behavior
- **Do not use `dangerouslySetInnerHTML`** to mount pages that need JavaScript interactivity

This avoids production hydration/runtime instability.

### Current status
- Dashboard interactivity follows this rule via `components/dashboard-react-client.tsx`.
- Some legacy prototype routes still render static prototype HTML via `dangerouslySetInnerHTML` (`/`, `/onboarding`, some coach prototype pages). These are candidates for future React conversion.

---

## 11) Key files to know first

- `app/dashboard/page.tsx` - server route wrapper + auth/data loading for dashboard
- `components/dashboard-react-client.tsx` - interactive member/coach dashboard UI
- `proxy.ts` - route protection middleware/proxy
- `lib/server/roles.ts` - role resolution + redirect logic
- `lib/server/actor.ts` - authenticated API actor context
- `app/api/**` - write/read endpoints
- `lib/server/sms-notifications.ts` - SMS orchestration and logging

---

## 12) Troubleshooting

### "Clerk is not configured"
- Verify:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`

### Role redirects not working
- Confirm `users` row exists for Clerk user and has correct `role`.
- Check Clerk webhook delivery and `POST /api/webhooks/clerk`.

### Supabase write errors / RLS issues
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set.
- Admin client is required by onboarding/webhooks/member settings updates.

### Messages empty
- Verify at least one active coach/staff user exists in `users`.
- Confirm `messages` table has required fields.

### SMS not sending
- Verify Twilio vars and recipient phone formatting.
- Check `sms_log` rows for status and error text.

---

## 13) Scripts

- `npm run dev` - local dev server
- `npm run lint` - lint
- `npm run build` - production build check
- `npm run start` - run built app
