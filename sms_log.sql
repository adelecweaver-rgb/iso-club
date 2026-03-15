create table if not exists public.sms_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  message_type text not null,
  message_body text not null,
  sent_at timestamptz not null default now(),
  status text not null
);

create index if not exists sms_log_member_sent_at_idx
  on public.sms_log (member_id, sent_at desc);

create index if not exists sms_log_type_sent_at_idx
  on public.sms_log (message_type, sent_at desc);
