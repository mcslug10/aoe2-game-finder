import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/server-supabase";
import { currentPlayerId } from "@/lib/session";
import { deleteExpiredRooms } from "@/lib/rooms";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await currentPlayerId();
    if (!playerId) {
      return NextResponse.json({ error: "Entre com seu nickname primeiro." }, { status: 401 });
    }

    const { id } = await context.params;
    const db = getAdminSupabase();
    await deleteExpiredRooms(db);

    const { data: room, error: roomError } = await db
      .from("rooms")
      .select("id,host_id,status")
      .eq("id", id)
      .eq("status", "open")
      .maybeSingle();

    if (roomError) throw roomError;
    if (!room) {
      return NextResponse.json({ error: "Sala não encontrada, expirada ou já encerrada." }, { status: 404 });
    }
    if (room.host_id !== playerId) {
      return NextResponse.json({ error: "Somente quem criou a sala pode encerrá-la." }, { status: 403 });
    }

    // Remove the room chat first; this is safe whether or not the FK is configured to cascade.
    const { error: messagesError } = await db.from("messages").delete().eq("room_id", id);
    if (messagesError) throw messagesError;

    const { data: deleted, error: deleteError } = await db
      .from("rooms")
      .delete()
      .eq("id", id)
      .eq("host_id", playerId)
      .eq("status", "open")
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deleted) {
      return NextResponse.json({ error: "A sala já foi encerrada por outra ação." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, roomId: id });
  } catch (error) {
    console.error("rooms DELETE", error);
    return NextResponse.json({ error: "Não foi possível encerrar a sala." }, { status: 500 });
  }
}
