-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS goal_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  suggested_by TEXT DEFAULT 'ai',
  status TEXT DEFAULT 'pending',
  suggestions JSONB,
  protocol_suggestion TEXT,
  protocol_reasoning TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  coach_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goal_suggestions_member_status_idx
  ON goal_suggestions (member_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS goal_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  goal_id UUID REFERENCES member_goals(id),
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  final_value NUMERIC,
  target_value NUMERIC,
  months_to_achieve INT,
  sessions_to_achieve INT,
  celebration_shown BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS goal_achievements_member_celebration_idx
  ON goal_achievements (member_id, celebration_shown, achieved_at DESC);
