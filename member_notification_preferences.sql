create table if not exists public.member_notification_preferences (
  member_id uuid primary key references public.users(id) on delete cascade,
  welcome_sms boolean not null default true,
  protocol_ready_sms boolean not null default true,
  scan_results_sms boolean not null default true,
  weekly_summary_sms boolean not null default true,
  session_reminder_sms boolean not null default true,
  low_recovery_sms boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists member_notification_preferences_updated_idx
  on public.member_notification_preferences (updated_at desc);
