# AOE2 Game Finder

Community matchmaking hub and replay-coaching companion for Age of Empires II: Definitive Edition.

## Main features

- PT-BR / English interface with a medieval AoE2-inspired layout.
- Global and community lobby browser.
- Nickname-based community chat, rooms and leaderboard.
- Official community Discord invitation.
- **AOE2 Coach (MVP):** search player profiles, view completed matches, retrieve available match analysis, and upload a local replay when analysis is not available.

## AOE2 Coach data sources

- Player profiles and match history use the AoE II Companion public data API (`https://data.aoe2companion.com/api/`).
- Match analysis uses the Companion `/api/matches/{matchId}/analysis` endpoint. The service returns parsed replay details when an analysis is available for that match.
- The World's Edge / Relic Link API is not the primary source for profile discovery in this MVP.
- The Companion API is a third-party community service and may change or rate-limit requests; the app handles errors and retries are left to the user.

## Optional Python parser for manual uploads

The Next.js app runs on Vercel. Manual replay file parsing uses a separate Python service because parsing `.aoe2record` files is CPU- and memory-intensive and should not run inside a short-lived Next.js request.

### 1. Deploy the Python parser

1. Open Render and create a **New Web Service** from this GitHub repository.
2. Set the root directory to `coach-service`.
3. Choose **Docker** as the runtime.
4. Add `COACH_SERVICE_TOKEN` with a long random secret (at least 32 characters).
5. Deploy the service and copy its HTTPS URL.

The parser health endpoint is `/health`. It accepts short-lived signed upload tokens and does not persist uploaded replay files.

### 2. Configure Vercel for manual uploads

Add these environment variables to the Vercel project for **Production** and **Preview**:

- `AOE2_COACH_SERVICE_URL`: Render HTTPS URL, without a trailing slash.
- `AOE2_COACH_SERVICE_TOKEN`: exactly the same secret configured on Render.

Redeploy Vercel after saving the variables.

### 3. Use the Coach

1. Open `/coach`.
2. Search by in-game nickname (the Companion search may return multiple profiles).
3. Select the correct profile.
4. Choose a completed match and click **Analisar replay**.
5. If the Companion API has no analysis for that match, upload the local `.aoe2record` file manually (requires the optional Render service).

## Analysis contents and limitations

- The report can include participant, civilization, map, game duration, eAPM, age-up timestamps, queued units, technologies, buildings and time-ordered build-order events.
- Strategy detection looks for evidence such as Dark Age militia, Archery Range + Archers, Stable + Scouts, Feudal towers, Fast Castle transitions, and Castle Age follow-ups. It returns the evidence and confidence instead of hiding the rule.
- The experimental execution score is split into opening execution (20), age timing (20), economy/production command regularity (20), military composition/technology (15), response to opponent pressure (15), and activity consistency (10). Activity consistency measures how many replay time intervals contain effective commands; it does not reward spam or treat high eAPM as skill. Unavailable categories are marked N/A and excluded from the normalized total; at least three categories must be available to show an overall score.
- Arabia 1v1 Normal timing comparisons are shown only when map, game mode, speed and speed factor match the benchmark context. Civilization bonuses and chosen build order can still affect timings.
- Reaction timing compares the first opponent military production event available in the replay data with your first detected counter-unit or wall command. This is not proof of the moment you saw the opponent.
- eAPM is a measure of effective command activity, not a standalone skill grade.
- Queue entries reflect observed queue commands; they do not necessarily equal the final number of completed units. Villager production gaps are estimates based on queued commands, not a direct measurement of TC idle time.
- Some opening classifier rules are adapted from the MIT-licensed `aoe2-openings` project; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Exact TC idle time, live resource curves and army value through time require additional simulation/reconstruction. A universal skill score is intentionally not fabricated.
- Strategy-specific scoring (Scout Rush, Archers, Fast Castle, etc.) can be added after defining benchmark build orders and criteria.

## Local development

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Run the optional Python parser locally from `coach-service`:

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
- Uploaded replay files are not stored by the parser.
- Public game/profile data is retrieved server-side; no user-provided secrets are needed to search a nickname.
