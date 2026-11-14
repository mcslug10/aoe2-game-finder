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

## Tracked player profiles and Steam presence

- Tracked players are configured in `lib/tracked-players.ts` with their AoE II Companion profile IDs.
- Clicking a tracked nickname opens the detailed profile panel with ladder ratings, current/peak rating, rank, win rate, favorite civilization/map, recent form and recent match teams.
- Steam presence uses the official Steam Web API `ISteamUser/GetPlayerSummaries`. It resolves the SteamID64 from the public AoE II Companion profile and queries Steam server-side; the Steam key is never sent to the browser.
- To enable Steam status, create a Steam Web API key at https://steamcommunity.com/dev/apikey and add `STEAM_WEB_API_KEY` to the Vercel project's Production and Preview environment variables. Redeploy after saving it.
- Without this key, the panel explains that Steam presence is not configured. Private Steam profiles are shown as private/unavailable rather than being incorrectly reported as offline.
- Steam presence and public AoE2 lobby presence are separate signals. A player can be online on Steam without appearing in a public lobby.


## AOE2 Coach build-guide recognition

- The Coach catalogue includes the 12 essential AoE II Companion build guides shown in its Build Guides section: Scout Rush, Archer Rush, Men-at-Arms Rush → Archers, Men-at-Arms + Tower Rush, Fast Castle → Boom, Fast Castle → Knights, Fast Castle → Unique Unit, Fast Imperial Age, Drush → Archers, Drush → Fast Castle, Fire Galleys and Archers, and Win Water.
- Titles and guidance are translated into Brazilian Portuguese while unit names such as Villagers, Militia, Scouts, Archers, Knights and Fire Galleys remain in English.
- During replay analysis the Coach classifies the most likely opening from detected age transitions, unit queues, buildings and technologies, then compares the replay with the matching guide's observable milestones.
- Each comparison step is marked as detected, not found in the returned replay events, or not verifiable from replay data. The adherence percentage uses only verifiable steps.
- Villager-by-villager resource assignments, exact resource stockpiles, building placement, tactical intent and other events not returned by the parser are not claimed as errors. A missing event means it was not found in the available data, not proof it did not happen.
- Each translated guide links back to its original AoE II Companion page. Builds can vary by civilization, map, balance patch and in-game adaptation; these are reference openings, not immutable scripts.

Source catalogue: https://aoecompanion.com/build-guides

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
