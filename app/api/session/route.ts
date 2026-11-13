import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminSupabase } from "@/lib/server-supabase";
import { guestCookieName, signPlayer, verifyPlayer } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nickname = String(body.nickname ?? "").trim().replace(/[<>]/g, "").slice(0, 24);
    if (nickname.length < 3 || !/^[\p{L}\p{N}_ .-]+$/u.test(nickname)) return NextResponse.json({ error: "Use um nickname de 3 a 24 caracteres." }, { status: 400 });
    const existingToken = req.cookies.get(guestCookieName)?.value;
    const existingId = verifyPlayer(existingToken);
    const db = getAdminSupabase();
    if (existingId) {
      const { data } = await db.from("players").select("id,nickname").eq("id", existingId).maybeSingle();
      if (data) {
        const { data: updated } = await db.from("players").update({ nickname, last_seen: new Date().toISOString() }).eq("id", existingId).select("id,nickname").single();
        if (updated) return NextResponse.json(updated);
      }
    }
    const { data: duplicate } = await db.from("players").select("id").ilike("nickname", nickname).limit(1).maybeSingle();
    if (duplicate) return NextResponse.json({ error: "Esse nickname já está em uso. Escolha outro." }, { status: 409 });
    const id = randomUUID();
    const { data, error } = await db.from("players").insert({ id, nickname, language: body.language === "en" ? "en" : "pt", last_seen: new Date().toISOString() }).select("id,nickname").single();
    if (error) throw error;
    const response = NextResponse.json(data);
    response.cookies.set(guestCookieName, signPlayer(id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    console.error("session route", error);
    return NextResponse.json({ error: "Não foi possível entrar. Confira a configuração do Supabase." }, { status: 500 });
  }
}
