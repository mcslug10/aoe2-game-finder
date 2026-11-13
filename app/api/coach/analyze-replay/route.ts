import { NextRequest, NextResponse } from "next/server";
import { getCompanionRecentMatches, getCompanionMatchAnalysis } from "@/lib/aoe2-coach";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = Number(body.profileId);
    const matchId = Number(body.matchId);
    if (!Number.isSafeInteger(profileId) || profileId <= 0 || !Number.isSafeInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Jogador ou partida inválidos." }, { status: 400 });
    }

    // Confirm the selected profile really participated in this match before requesting analysis.
    const { matches } = await getCompanionRecentMatches(profileId);
    const match = matches.find((item) => item.id === String(matchId));
    if (!match || !match.includesPlayer) {
      return NextResponse.json({
        error: "Não foi possível confirmar que este perfil participou da partida. Atualize o histórico e tente novamente.",
      }, { status: 403 });
    }

    const report = await getCompanionMatchAnalysis(matchId, profileId);
    return NextResponse.json({ report, match, source: "aoe2companion-analysis" });
  } catch (error) {
    console.error("coach match analysis", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível carregar a análise desta partida.",
    }, { status: 502 });
  }
}
