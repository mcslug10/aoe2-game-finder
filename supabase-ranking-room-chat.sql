-- AOE2 Game Finder: base para ranking e chat por sala
-- Execute no Supabase > SQL Editor > New query.
-- Este script libera SOMENTE leitura pública. Não abre INSERT/UPDATE/DELETE.

create index if not exists messages_player_id_created_at_idx
  on public.messages (player_id, created_at desc);

create index if not exists messages_room_id_created_at_idx
  on public.messages (room_id, created_at asc);

create index if not exists rooms_status_created_at_idx
  on public.rooms (status, created_at desc);

-- O chat global usa room_id = NULL; mensagens com room_id preenchido
-- pertencem exclusivamente à sala correspondente.

-- Ranking por quantidade de mensagens enviadas.
create or replace view public.player_message_leaderboard
with (security_invoker = true) as
select
  p.id as player_id,
  p.nickname,
  count(m.id)::bigint as message_count,
  max(m.created_at) as last_message_at
from public.players p
join public.messages m on m.player_id = p.id
 group by p.id, p.nickname
 order by count(m.id) desc, max(m.created_at) desc;

grant select on public.player_message_leaderboard to anon, authenticated;

-- Políticas de leitura: visitantes podem carregar salas, nicknames e mensagens.
-- Escrita continuará fechada até a próxima etapa, quando ativaremos endpoints
-- de servidor com validação de nickname, sessão e limite anti-spam.

drop policy if exists "Public can read rooms" on public.rooms;
create policy "Public can read rooms"
  on public.rooms for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read player nicknames" on public.players;
create policy "Public can read player nicknames"
  on public.players for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read chat messages" on public.messages;
create policy "Public can read chat messages"
  on public.messages for select
  to anon, authenticated
  using (true);
