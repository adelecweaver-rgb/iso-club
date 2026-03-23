-- ─── Health Profile & Onboarding History Migration ───────────────────────────
-- Run once in Supabase SQL Editor.
-- Safe to run multiple times (all statements are idempotent).

-- 1. Extend users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS member_status          TEXT DEFAULT 'active',
  -- 'active' | 'awaiting_protocol' | 'review_requested'
  ADD COLUMN IF NOT EXISTS onboarding_submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_updated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_limitations       TEXT[]  DEFAULT '{}',
  -- structured array: 'lower_back' | 'knees' | 'hips' | 'neck' |
  --                   'pelvic_floor' | 'osteoporosis' | 'none' | 'other'
  ADD COLUMN IF NOT EXISTS motivation_style         TEXT;
  -- 'performance' | 'longevity' | 'weight_loss' | 'general_health'

-- 2. Onboarding snapshots — full answer snapshot on every save (the history[])
CREATE TABLE IF NOT EXISTS onboarding_snapshots (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_requested BOOLEAN     NOT NULL DEFAULT false,
  answers          JSONB       NOT NULL
  -- answers shape (OnboardingAnswers):
  -- {
  --   goals: string[],
  --   health_limitations: string[],
  --   notes: string | null,
  --   days_available_per_week: number | null,
  --   contrast_therapy_pref: string | null,
  --   motivation_style: string | null
  -- }
);

CREATE INDEX IF NOT EXISTS onboarding_snapshots_member_saved
  ON onboarding_snapshots(member_id, saved_at DESC);

-- 3. Member in-app notifications (single table for ALL member notifications going forward)
--    This replaces/supersedes any per-feature notification mechanism.
--    SMS (sms_log) remains separate and is the channel for SMS delivery only.
CREATE TABLE IF NOT EXISTS member_notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  -- 'protocol_reviewed'   — coach reviewed profile update, protocol unchanged
  -- 'protocol_updated'    — coach reviewed and changed protocol
  -- 'protocol_assigned'   — initial protocol assignment (future use)
  message    TEXT        NOT NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS member_notifications_member_id
  ON member_notifications(member_id, created_at DESC);

-- 4. Add payload column to coach_notifications for structured review data
ALTER TABLE public.coach_notifications
  ADD COLUMN IF NOT EXISTS payload JSONB;
  -- for type='protocol_review_requested':
  -- {
  --   diff: FieldDiff[],               -- changed fields {field, label, oldValue, newValue}
  --   recommendation: string | null,   -- recommendProtocol() result name
  --   recommendation_reason: string | null
  -- }
