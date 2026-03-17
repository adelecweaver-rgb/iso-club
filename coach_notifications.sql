-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS coach_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  type TEXT, -- 'protocol_change_request', 'general'
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
