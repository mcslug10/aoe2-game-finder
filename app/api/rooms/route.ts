import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/server-supabase";
import { currentPlayerId } from "@/lib/session";

export const runtime = "nodejs";

function isMissingLobbyColumn(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" ||
    (error.message ?? "").toLowerCase().includes("game_lobby_id");
}

export async function GET() {
  try {
    const db = getAdminSupabase();
    const baseColumns = "id,host_id,title,game_mode,map_name,min_elo,max_elo,region,status,created_at,players(nickname)";
    let { data, error } = await db
      .from("rooms")
      .select(`${baseColumns},game_lobby_id`)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);

    // Keep the existing site working before the optional SQL migration is applied.
    // In this fallback, community rooms simply have no linked in-game lobby ID yet.
    const lobbyColumnAvailable = !error;
    if (error && isMissingLobbyColumn(error)) {
      const fallback = await db
        .from("rooms")
        .select(baseColumns)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;

    return NextResponse.json({
      rooms: (data ?? []).map((room) => ({
        id: room.id,
        title: room.title,
        mode: room.game_mode,
        map: room.map_name,
        elo: room.min_elo == null && room.max_elo == null ? "Any ELO" : `${room.min_elo ?? "?"}–${room.max_elo ?? "?"}`,
        region: room.region ?? "Any region",
        host: room.players?.[0]?.nickname ?? "Jogador",
        players: "1/8",
        game_lobby_id: lobbyColumnAvailable ? room.game_lobby_id ?? null : null,
      })),
      lobbyLinkingAvailable: lobbyColumnAvailable,
    });
  } catch (error) {
    console.error("rooms GET", error);
    return NextResponse.json({ error: "Falha ao carregar salas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const playerId = await currentPlayerId();
    if (!playerId) return NextResponse.json({ error: "Entre com seu nickname primeiro." }, { status: 401 });

    const body = await req.json();
    const title = String(body.title ?? "").trim().slice(0, 60);
    const mode = String(body.mode ?? "1v1");
    const map = String(body.map ?? "Arabia");
    const elo = String(body.elo ?? "Any ELO");
    const lobbyIdInput = String(body.gameLobbyId ?? "").trim();

    if (lobbyIdInput && !/^\d{4,20}$/.test(lobbyIdInput)) {
      return NextResponse.json({ error: "Informe um ID numérico válido do lobby do Age of Empires II." }, { status: 400 });
    }
    if (title.length < 4 || !["1v1", "2v2", "3v3", "4v4"].includes(mode) || !["Arabia", "Arena", "Black Forest", "Nomad", "Random"].includes(map)) {
      return NextResponse.json({ error: "Dados da sala inválidos." }, { status: 400 });
    }

    let min_elo: number | null = null;
    let max_elo: number | null = null;
    const range = elo.match(/(\d{3,4})\s*[–-]\s*(\d{3,4})/);
    if (range) {
      min_elo = Number(range[1]);
      max_elo = Number(range[2]);
    } else if (elo === "Below 1000") {
      max_elo = 999;
    } else if (/^\d{4}\+$/.test(elo)) {
      min_elo = Number(elo.slice(0, -1));
    }

    const db = getAdminSupabase();
    const insertPayload = {
      host_id: playerId,
      title,
      game_mode: mode,
      map_name: map,
      min_elo,
      max_elo,
      region: "Any region",
      status: "open",
      ...(lobbyIdInput ? { game_lobby_id: lobbyIdInput } : {}),
    };

    const { data, error } = await db
      .from("rooms")
      .insert(insertPayload)
      .select("id,title,game_mode,map_name,min_elo,max_elo,region,status,created_at")
      .single();
    if (error) {
      if (lobbyIdInput && isMissingLobbyColumn(error)) {
        return NextResponse.json({ error: "Para vincular um lobby real, execute primeiro a migração game_lobby_id no Supabase." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      room: {
        id: data.id,
        title: data.title,
        mode: data.game_mode,
        map: data.map_name,
        elo,
        region: data.region ?? "Any region",
        host: "Você",
        players: mode === "1v1" ? "1/2" : mode === "2v2" ? "1/4" : mode === "3v3" ? "1/6" : "1/8",
        game_lobby_id: lobbyIdInput || null,
      },
    });
  } catch (error) {
    console.error("rooms POST", error);
    return NextResponse.json({ error: "Não foi possível criar a sala." }, { status: 500 });
  }
}
