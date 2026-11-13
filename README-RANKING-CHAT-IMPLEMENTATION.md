# AOE2 Game Finder — ranking e chat por sala

Esta versão acrescenta:
- ranking dos 10 nicknames com mais mensagens;
- chat global (`messages.room_id IS NULL`);
- chat exclusivo por sala (`messages.room_id = rooms.id`);
- salas, mensagens e ranking carregados do Supabase;
- criação de nickname de visitante com cookie HttpOnly assinado;
- rotas server-side para escrita, mantendo a chave secreta fora do navegador;
- atualização periódica da interface a cada 5 segundos.

## Antes de publicar
Na Vercel, em Project → Settings → Environment Variables, confirme:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (chave Secret do Supabase; nunca usar prefixo NEXT_PUBLIC_)

A variável `SUPABASE_SECRET_KEY` deve estar disponível em Production, Preview e Development, conforme necessário. Depois de salvar, faça um novo Deploy.

## Atualizar o GitHub
1. Baixe e extraia o ZIP desta versão.
2. Substitua no repositório os arquivos pelas versões extraídas, mantendo a estrutura de pastas.
3. Faça commit/push para a branch `main`.
4. Aguarde o deploy automático na Vercel.

## Atenção ao esquema do Supabase
A implementação usa as tabelas já preparadas no projeto:
- `players`: `id`, `nickname`, `language`, `last_seen`, `created_at`;
- `rooms`: `id`, `host_id`, `title`, `game_mode`, `map_name`, `min_elo`, `max_elo`, `region`, `status`, `created_at`;
- `messages`: `id`, `player_id`, `room_id`, `message`, `created_at`.

A view `player_message_leaderboard` criada pelo SQL anterior é usada para o ranking. As rotas assumem que `rooms.host_id` referencia `players.id`, e `messages.player_id` referencia `players.id`.

## Segurança e limites do MVP
- A chave secreta é usada somente em rotas de servidor e não deve ser exposta no cliente.
- O cookie do visitante é HttpOnly e assinado no servidor.
- Mensagens são limitadas a 240 caracteres e links são recusados.
- Existe um intervalo mínimo simples entre mensagens por jogador.
- Antes de divulgar o site em grande escala, recomenda-se adicionar rate limit persistente (por exemplo, Upstash/Redis), moderação/denúncia e controle de banimento. O intervalo simples atual não substitui proteção anti-spam robusta.
- A interface consulta as mensagens a cada 5 segundos. O Realtime pode ser conectado numa etapa posterior para atualização instantânea.
