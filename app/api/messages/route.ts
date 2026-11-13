import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/server-supabase";
import { currentPlayerId } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const roomId = req.nextUrl.searchParams.get("roomId");
    const db = getAdminSupabase();
    let query = db.from("messages").select("id,player_id,room_id,message,created_at,players(nickname)").order("created_at", { ascending: true }).limit(100);
    query = roomId ? query.eq("room_id", roomId) : query.is("room_id", null);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ messages: (data ?? []).map((m) => ({ id: m.id, name: r.players?.[0]?.nickname ?? "Jogador", text: m.message, time: new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), playerId: m.player_id })) });
  } catch (error) { console.error("messages GET", error); return NextResponse.json({ error: "Falha ao carregar mensagens." }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  try {
    const playerId = await currentPlayerId();
    if (!playerId) return NextResponse.json({ error: "Entre com seu nickname primeiro." }, { status: 401 });
    const body = await req.json();
    const message = String(body.message ?? "").trim();
    const roomId = body.roomId ? String(body.roomId) : null;
    if (!message || message.length > 240 || /https?:\/\/|www\./i.test(message) || /<[^>]*>/.test(message)) return NextResponse.json({ error: "Mensagem inválida. Links não são permitidos." }, { status: 400 });
    const db = getAdminSupabase();
    if (roomId) {
      const { data: room } = await db.from("rooms").select("id").eq("id", roomId).eq("status", "open").maybeSingle();
      if (!room) return NextResponse.json({ error: "Sala não encontrada ou encerrada." }, { status: 404 });
    }
    const { data: recent } = await db.from("messages").select("created_at").eq("player_id", playerId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 1800) return NextResponse.json({ error: "Aguarde um instante antes de enviar outra mensagem." }, { status: 429 });
    const { error } = await db.from("messages").insert({ player_id: playerId, room_id: roomId, message });
    if (error) throw error;
    await db.from("players").update({ last_seen: new Date().toISOString() }).eq("id", playerId);
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("messages POST", error); return NextResponse.json({ error: "Não foi possível enviar a mensagem." }, { status: 500 }); }
}
