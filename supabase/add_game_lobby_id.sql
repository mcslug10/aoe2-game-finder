-- AOE2 Game Finder: associate a community room with a real Age of Empires II: DE lobby.
-- Safe to run multiple times.
alter table public.rooms
  add column if not exists game_lobby_id text;

create index if not exists rooms_game_lobby_id_idx
  on public.rooms (game_lobby_id)
  where game_lobby_id is not null;

comment on column public.rooms.game_lobby_id is
  'Optional Age of Empires II: Definitive Edition lobby ID shown in the Game Finder community browser.';
