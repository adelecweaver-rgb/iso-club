-- Run once in Supabase SQL editor before/alongside ARX historical imports.
-- Ensures ARX import mapping columns exist.

alter table if exists public.arx_sessions
  add column if not exists machine_type text;

alter table if exists public.arx_sessions
  add column if not exists external_id text;

alter table if exists public.arx_sessions
  add column if not exists duration text;

alter table if exists public.arx_sessions
  add column if not exists speed text;

create unique index if not exists arx_sessions_external_id_unique
  on public.arx_sessions (external_id)
  where external_id is not null;
