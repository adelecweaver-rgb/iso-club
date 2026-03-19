-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS member_schedule_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  protocol_day_id UUID REFERENCES protocol_days(id),
  original_day_of_week INT,
  override_day_of_week INT,
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, protocol_day_id, week_start)
);

-- Add customization notes to member_protocols
ALTER TABLE member_protocols
  ADD COLUMN IF NOT EXISTS customization_notes TEXT;
