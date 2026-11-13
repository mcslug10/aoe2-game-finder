import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { currentPlayerId } from "@/lib/session";

export const runtime = "nodejs";

function createUploadToken(playerId: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({
    sub: playerId,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    scope: "replay:analyze",
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Entre com seu nickname no Game Finder antes de enviar um replay." }, { status: 401 });
  }
  const serviceUrl = process.env.AOE2_COACH_SERVICE_URL?.replace(/\/$/, "");
  const secret = process.env.AOE2_COACH_SERVICE_TOKEN;
  if (!serviceUrl || !secret) {
    return NextResponse.json({
      error: "O analisador de replays ainda não foi conectado. O serviço Python precisa ser publicado e configurado na Vercel.",
    }, { status: 503 });
  }
  return NextResponse.json({
    serviceUrl,
    token: createUploadToken(playerId, secret),
    expiresIn: 600,
  }, { headers: { "Cache-Control": "no-store" } });
}
