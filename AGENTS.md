# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is the **Iso Club Member Portal** — a Next.js 16 (App Router, Turbopack) web app with Clerk authentication and Supabase integration scaffolding. There is one service: the Next.js dev server.

### Running the app

See `README.md` **§1 Local run** for standard commands (`npm run dev`, `npm run lint`, `npm run build`).

### Environment variables

Copy `.env.example` to `.env.local` and fill in real keys. The Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) are **required** — the Clerk middleware runs on every request and will return HTTP 500 if the publishable key is missing or invalid. Supabase keys are optional; the dashboard renders a "Needs setup" banner when they are absent.

### Non-obvious notes

- The middleware file is `proxy.ts` at the project root (not the conventional `middleware.ts`). Next.js still picks it up — the build output confirms `ƒ Proxy (Middleware)`.
- The dashboard page (`app/dashboard/page.tsx`) reads `/index.html` from the project root at runtime via `fs.readFile` and embeds it in an iframe via `srcDoc`. If `index.html` is missing, a fallback error message renders.
- There are no automated tests in this repository (no test framework configured).
- ESLint uses the flat config format (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TypeScript presets.
