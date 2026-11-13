# Próxima etapa — Ranking e chat por sala

O banco já possui `messages.room_id`. A regra será:
- `room_id IS NULL`: chat global.
- `room_id = ID da sala`: chat exclusivo daquela sala.

## Preparar o Supabase
1. Abra o projeto no Supabase.
2. Entre em **SQL Editor** → **New query**.
3. Abra o arquivo `supabase-ranking-room-chat.sql`, copie todo o conteúdo e cole no editor.
4. Clique em **Run**.
5. Se aparecer erro, pare e envie uma captura da mensagem.

O script cria índices e a view `player_message_leaderboard`, além de políticas apenas de leitura pública. Ele NÃO abre escrita pública nas tabelas.

## Segurança e próxima implementação
Para permitir que visitantes sem cadastro enviem mensagens e criem salas, a próxima etapa usará rotas do servidor na Vercel com validação de nickname/sessão, limite de mensagens e moderação. A chave `service_role`/secret nunca deve ser colocada em variável `NEXT_PUBLIC_` nem no navegador.
