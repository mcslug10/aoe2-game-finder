-- Adds an optional link from a Game Finder community room to a real AoE2:DE lobby.
-- Safe to run more than once.
alter table public.rooms
  add column if not exists game_lobby_id text;

create index if not exists rooms_game_lobby_id_idx
  on public.rooms (game_lobby_id)
  where game_lobby_id is not null;

comment on column public.rooms.game_lobby_id is
  'Optional Age of Empires II: Definitive Edition custom lobby game ID used by the community browser.';
