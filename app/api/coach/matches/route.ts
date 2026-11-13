import { NextRequest, NextResponse } from "next/server";
import { getCompanionRecentMatches } from "@/lib/aoe2-coach";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const profileId = Number(req.nextUrl.searchParams.get("profileId"));
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    return NextResponse.json({ error: "profile_id inválido." }, { status: 400 });
  }
  try {
    const data = await getCompanionRecentMatches(profileId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=0, s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("coach match history", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Falha ao carregar histórico de partidas.",
    }, { status: 502 });
  }
}
