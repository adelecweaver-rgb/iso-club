-- Run once in Supabase SQL editor to persist CAROL auth tokens for re-sync.

alter table if exists public.users
  add column if not exists carol_token text,
  add column if not exists carol_rider_id text,
  add column if not exists carol_username text;
