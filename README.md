# AOE2 Game Finder

Community matchmaking hub and replay-coaching companion for Age of Empires II: Definitive Edition.

## Main features

- PT-BR / English interface with a medieval AoE2-inspired layout.
- Global and community lobby browser.
- Nickname-based community chat, rooms and leaderboard.
- Official community Discord invitation.
- **AOE2 Coach (MVP):** lookup of a player's public profile and completed match history, automatic replay download when available, manual replay upload, and objective replay analysis.

## AOE2 Coach deployment

The Next.js app runs on Vercel. Replay parsing uses a separate Python service because parsing `.aoe2record` files is CPU- and memory-intensive and should not run inside a short-lived Next.js request.

### 1. Deploy the Python parser

1. Open Render and create a **New Web Service** from this GitHub repository.
2. Set the root directory to `coach-service`.
3. Choose **Docker** as the runtime.
4. Add an environment variable named `COACH_SERVICE_TOKEN` with a long random secret (at least 32 characters).
5. Deploy the service and copy its HTTPS URL.

The parser health endpoint is `/health`. The service accepts short-lived signed upload tokens from the Game Finder and does not persist uploaded replay files.

### 2. Configure Vercel

Add these environment variables to the Vercel project for **Production** and **Preview**:

- `AOE2_COACH_SERVICE_URL`: the Render HTTPS URL, without a trailing slash.
- `AOE2_COACH_SERVICE_TOKEN`: exactly the same secret used by the parser service.

Redeploy Vercel after saving the variables.

### 3. Use the Coach

1. Open `/coach`.
2. Search using the exact in-game nickname (case-sensitive).
3. Select the correct profile if more than one is returned.
4. Choose a completed match and click **Analisar replay**. The app verifies that the profile participated in the match before requesting a replay.
5. If the automatic replay is unavailable, upload the `.aoe2record` file manually.

## Data sources and limitations

- Player profile and completed match history come from the community-maintained, reverse-engineered World's Edge / Relic Link API. It is unofficial and may change without notice.
- The automatic replay download endpoint is reverse-engineered and may be unavailable for some matches or profiles. Manual upload is the fallback.
- The replay parser is `aoc-mgz`, an open-source MIT-licensed Python parser that supports Definitive Edition `.aoe2record` files.
- The report shows evidence present in the replay: participants, map, duration, eAPM/APM when available, age-up events, and observed build/queue/research commands.
- APM/eAPM are activity measures, not skill scores. Queue command counts are not guaranteed to equal units actually produced.
- A reliable global skill grade, TC idle time, exact resource curves and full army-value history require a selected build-order benchmark and/or replaying the game simulation. The MVP intentionally does not invent those values.

## Local development

- Node.js 20.9+
- npm

```bash
npm install
npm run dev
```

The Python parser can be run locally from `coach-service`:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export COACH_SERVICE_TOKEN="your-long-random-secret"
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Security notes

- Never expose Supabase secret/service-role keys in browser code or `NEXT_PUBLIC_` variables.
- The parser service is protected by short-lived HMAC-signed upload tokens and limits uploads to 100 MB.
- The service does not store uploaded replay files.
- The Vercel server verifies that a selected profile participated in a match before requesting its replay.
- The World's Edge endpoints are unofficial; cache requests, send an identifying User-Agent, and handle 429/5xx responses gracefully.
