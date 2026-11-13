import { NextRequest, NextResponse } from "next/server";
import { searchCompanionProfiles } from "@/lib/aoe2-coach";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const alias = String(req.nextUrl.searchParams.get("nickname") ?? "").trim();
  if (alias.length < 3 || alias.length > 32) {
    return NextResponse.json({ error: "Informe o nickname exato do Age of Empires II (3 a 32 caracteres)." }, { status: 400 });
  }

  try {
    const data = await searchCompanionProfiles(alias);
    if (!data.profiles.length) {
      return NextResponse.json({ error: "Nenhum perfil encontrado. Confira a grafia do nickname e tente novamente." }, { status: 404 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=0, s-maxage=180, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("coach player lookup", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Falha ao buscar o jogador.",
    }, { status: 502 });
  }
}
