-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  checkin_date DATE DEFAULT CURRENT_DATE,
  feeling TEXT, -- 'low', 'normal', 'strong'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, checkin_date)
);
