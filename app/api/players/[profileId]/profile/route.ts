import { NextResponse } from "next/server";
import { companionGet, getCompanionRecentMatches } from "@/lib/aoe2-coach";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId: rawProfileId } = await context.params;
  const profileId = Number(rawProfileId);

  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    return NextResponse.json({ error: "Profile ID inválido." }, { status: 400 });
  }

  try {
    const [profile, recent] = await Promise.all([
      companionGet(`profiles/${profileId}`, {
        language: "pt",
        extend: "avatar_medium_url,avatar_full_url,last_10_matches_won,stats_civ_map",
        page: "1",
      }),
      getCompanionRecentMatches(profileId),
    ]);

    if (Number(profile.profileId) !== profileId) {
      return NextResponse.json({ error: "O AoE II Companion não retornou o perfil solicitado." }, { status: 404 });
    }

    return NextResponse.json(
      {
        profile,
        matches: recent.matches,
        source: "AoE II Companion",
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, s-maxage=300, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("tracked player profile", profileId, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar o perfil do jogador." },
      { status: 502 },
    );
  }
}
