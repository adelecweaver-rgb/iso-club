-- Run in Supabase SQL Editor to enable ARX credential-based sync
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS arx_username TEXT;
