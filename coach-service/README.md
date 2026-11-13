# AOE2 Coach Parser Service

Serviço Python que interpreta arquivos `.aoe2record` usando o parser open-source `aoc-mgz`.

## Publicar no Render

1. Crie um **New Web Service** no Render e conecte este repositório GitHub.
2. Escolha **Docker** como runtime.
3. Defina a pasta raiz como `coach-service`.
4. Adicione a variável `COACH_SERVICE_TOKEN` com um segredo aleatório forte (guarde o mesmo valor para a Vercel).
5. Publique o serviço e copie a URL HTTPS gerada, por exemplo `https://aoe2-coach-parser.onrender.com`.

O health check fica em `/health`.

## Variáveis na Vercel

No projeto `aoe2-game-finder`, adicione:

- `AOE2_COACH_SERVICE_URL`: URL HTTPS do serviço Render, sem barra no final.
- `AOE2_COACH_SERVICE_TOKEN`: o mesmo segredo configurado no Render.

Marque Production e Preview e faça um novo deploy.

## Segurança

O navegador solicita à aplicação um token de upload assinado, de curta duração (10 minutos) e vinculado à sessão do Game Finder. O serviço parser valida esse token antes de aceitar arquivos. O endpoint não grava nem mantém o replay enviado.

## Limites do MVP

- Arquivos/replays ZIP de até 100 MB.
- A resposta contém eventos objetivos detectados pelo parser: participantes, mapa, duração, eAPM, comandos de produção/construção/pesquisa e transições de idade quando disponíveis.
- Recursos exatos e aldeões ociosos exigem reconstruir a simulação com o motor do jogo.
