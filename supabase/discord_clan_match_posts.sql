create table if not exists public.discord_clan_match_posts (
  match_id text primary key,
  posted_at timestamptz not null default now(),
  tracked_profile_id bigint,
  match_payload jsonb not null default '{}'::jsonb
);
alter table public.discord_clan_match_posts enable row level security;
-- No client-side policies. Access only from the server using SUPABASE_SECRET_KEY.
