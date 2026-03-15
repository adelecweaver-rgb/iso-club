# Iso Club Member Portal

This project is now a **Next.js app** with:

- **Clerk authentication** (sign in / sign up / protected dashboard)
- **Supabase integration** (server + browser clients ready)
- Your original dashboard design preserved in `index.html` and rendered inside the protected dashboard route

## 1) Local run (optional)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create env file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in your Clerk and Supabase keys in `.env.local`.

4. Start:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## 2) Vercel deploy (non-technical friendly)

1. Push code to GitHub (already done on your feature branch).
2. In Vercel, import this GitHub repo.
3. In Vercel Project Settings → **Environment Variables**, add all variables from `.env.example`.
4. Click Deploy.

### Required env vars

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose client-side)

### Optional but recommended

- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard`

## 3) Where to edit the dashboard

- Main dashboard markup/style/script: `index.html`
- Auth-protected app route that displays it: `app/dashboard/page.tsx`

## 4) Project scripts

- `npm run dev` – local development
- `npm run lint` – lint checks
- `npm run build` – production build check
- `npm run start` – run production build
