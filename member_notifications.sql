-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS member_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS member_notifications_member_created_idx
  ON member_notifications (member_id, created_at DESC);
