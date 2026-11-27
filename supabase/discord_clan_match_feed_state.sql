-- Per-clan feed watermark. The first scheduled call creates a baseline and posts nothing,
-- preventing the API's historical recent-match window from being backfilled.
create table if not exists public.discord_clan_match_feed_state (
  feed_key text primary key,
  last_successful_scan_at timestamptz not null
);
alter table public.discord_clan_match_feed_state enable row level security;
-- No client policies; server-only access via the Supabase service role.
