import { NextRequest, NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/session";
import { createHmac } from "node:crypto";
import { getAoERecentMatches } from "@/lib/aoe2-coach";

export const runtime = "nodejs";
export const maxDuration = 60;

function parserConfig() {
  const serviceUrl = process.env.AOE2_COACH_SERVICE_URL?.replace(/\/$/, "");
  const secret = process.env.AOE2_COACH_SERVICE_TOKEN;
  if (!serviceUrl || !secret) throw new Error("O serviço Python do AOE2 Coach ainda não foi configurado.");
  return { serviceUrl, secret };
}

function createServiceToken(playerId: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ sub: playerId, exp: Math.floor(Date.now() / 1000) + 600, scope: "replay:analyze" })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function parseReplay(bytes: ArrayBuffer, filename: string, secret: string, serviceUrl: string, playerId: string, profileId: number) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/zip" }), filename);
  form.append("profile_id", String(profileId));
  const response = await fetch(`${serviceUrl}/analyze`, {
    method: "POST",
    headers: { Authorization: `Bearer ${createServiceToken(playerId, secret)}` },
    body: form,
    signal: AbortSignal.timeout(55000),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : "O analisador não conseguiu interpretar o replay.");
  }
  return body;
}

export async function POST(req: NextRequest) {
  const ownerPlayerId = await currentPlayerId();
  if (!ownerPlayerId) {
    return NextResponse.json({ error: "Entre com seu nickname no Game Finder antes de analisar uma partida." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const profileId = Number(body.profileId);
    const matchId = String(body.matchId ?? "");
    if (!Number.isSafeInteger(profileId) || profileId <= 0 || !/^\d{1,20}$/.test(matchId)) {
      return NextResponse.json({ error: "Jogador ou partida inválidos." }, { status: 400 });
    }

    const config = parserConfig();
    const { matches } = await getAoERecentMatches(profileId);
    const match = matches.find((item) => item.id === matchId);
    if (!match || !match.includesPlayer) {
      return NextResponse.json({ error: "Não foi possível confirmar que este perfil participou da partida." }, { status: 403 });
    }

    const replayUrl = new URL("https://api.ageofempires.com/api/GameStats/AgeII/GetMatchReplay/");
    replayUrl.searchParams.set("gameId", matchId);
    replayUrl.searchParams.set("profileId", String(profileId));
    replayUrl.searchParams.set("matchId", matchId);

    const replayResponse = await fetch(replayUrl, {
      headers: { Accept: "application/zip, application/octet-stream", "User-Agent": "AOE2-Game-Finder/1.0 (+https://aoe2-game-finder.vercel.app)" },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!replayResponse.ok) {
      const hint = replayResponse.status === 404
        ? "O replay não está disponível para este jogador ou partida. Tente enviar o arquivo .aoe2record manualmente."
        : `O serviço de replay respondeu HTTP ${replayResponse.status}. Você pode enviar o arquivo .aoe2record manualmente.`;
      return NextResponse.json({ error: hint, manualUploadAvailable: true }, { status: 424 });
    }

    const bytes = await replayResponse.arrayBuffer();
    if (bytes.byteLength > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "O replay excede o limite de 100 MB." }, { status: 413 });
    }

    const report = await parseReplay(bytes, `AgeIIDE_Replay_${matchId}.zip`, config.secret, config.serviceUrl, ownerPlayerId, profileId);
    return NextResponse.json({ report, match, source: "automatic-replay-download" });
  } catch (error) {
    console.error("coach automatic replay analysis", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível analisar o replay.",
    }, { status: 502 });
  }
}
