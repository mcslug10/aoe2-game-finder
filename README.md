# AOE2 Game Finder

Starter project for an international Age of Empires II: Definitive Edition community matchmaking hub.

## Current state

This first delivery is a **front-end prototype**. It includes:
- Responsive dark medieval-inspired interface
- Demo lobby list and client-side filters
- Nickname entry (no account UI)
- Local demo chat interaction
- Create-room modal

The sample rooms and messages are local demo data. They are **not yet shared between visitors**. The next implementation step is to add secure server endpoints, persistent player sessions, Supabase Realtime, rate limits and moderation before enabling public writes.

## Requirements

- Node.js 20.9+
- npm

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The UI works in demo mode without Supabase credentials. Add the Supabase URL and publishable key to `.env.local` when we implement the backend.

## Deploy to Vercel

1. Push this folder to a private GitHub repository named `aoe2-game-finder`.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Keep the detected Next.js settings.
4. Add environment variables when the Supabase integration is implemented.
5. Deploy.

## Security notes

- Never expose Supabase secret/service-role keys in browser code or `NEXT_PUBLIC_` variables.
- The current Supabase tables have RLS enabled and no public policies. Keep them that way for now.
- Do not add permissive public insert/update policies to chat or player tables. Anonymous chat should be implemented through server-side validation and rate limiting.
- Realtime publication enables change delivery; it does not itself grant table access or implement authorization.

## Planned next steps

1. Secure anonymous nickname/session endpoint.
2. Server-side message validation, profanity/link filtering and rate limiting.
3. Supabase Realtime chat and presence.
4. Persistent room creation and room membership.
5. Moderation queue, reports, mute and ban tools.
6. Real player/game data integrations, if a suitable supported source is available.
