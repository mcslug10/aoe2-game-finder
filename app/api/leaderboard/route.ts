import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function GET() {
  try {
    const { data, error } = await getAdminSupabase().from("player_message_leaderboard").select("player_id,nickname,message_count,last_message_at").order("message_count", { ascending: false }).limit(10);
    if (error) throw error;
    return NextResponse.json({ players: data ?? [] });
  } catch (error) { console.error("leaderboard GET", error); return NextResponse.json({ error: "Falha ao carregar ranking." }, { status: 500 }); }
}
