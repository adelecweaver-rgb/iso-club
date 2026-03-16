-- Run once in Supabase SQL editor for CAROL API sync support.
-- Adds fields needed by /api/carol/sync and enables safe re-sync via external_id.

alter table if exists public.carol_sessions
  add column if not exists external_id text,
  add column if not exists user_id uuid,
  add column if not exists duration_seconds numeric,
  add column if not exists avg_sprint_power numeric,
  add column if not exists manp numeric,
  add column if not exists heart_rate_max numeric,
  add column if not exists heart_rate_avg numeric,
  add column if not exists hr_percent_age_limit numeric,
  add column if not exists calories_incl_epoc numeric,
  add column if not exists calories_active numeric,
  add column if not exists avg_power_watts numeric,
  add column if not exists resistance_absolute numeric,
  add column if not exists sequential_number integer,
  add column if not exists is_valid boolean,
  add column if not exists octane_score numeric,
  add column if not exists distance_meters numeric,
  add column if not exists rpm_max numeric,
  add column if not exists sprint_duration_seconds numeric;

create unique index if not exists carol_sessions_external_id_unique
  on public.carol_sessions (external_id)
  where external_id is not null;
