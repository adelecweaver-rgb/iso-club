-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS member_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('gain_muscle', 'lose_fat', 'improve_cardio', 'attendance')),
  is_active BOOLEAN DEFAULT true,
  set_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, goal_type)
);
