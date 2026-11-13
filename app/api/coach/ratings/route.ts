import { NextRequest, NextResponse } from "next/server";
import { getCompanionRatingHistory } from "@/lib/aoe2-coach-ratings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const profileId = Number(req.nextUrl.searchParams.get("profileId"));
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    return NextResponse.json({ error: "profile_id inválido." }, { status: 400 });
  }

  try {
    const history = await getCompanionRatingHistory(profileId);
    return NextResponse.json(history, {
      headers: { "Cache-Control": "private, max-age=0, s-maxage=900, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("coach rating history", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível carregar o histórico de rating.",
    }, { status: 502 });
  }
}
