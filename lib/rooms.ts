import { getAdminSupabase } from "@/lib/server-supabase";

export const ROOM_LIFETIME_MS = 2 * 60 * 60 * 1000;

export function roomExpiresAt(createdAt: string) {
  return new Date(new Date(createdAt).getTime() + ROOM_LIFETIME_MS).toISOString();
}

/**
 * Remove expired community rooms and their chat messages.
 * Called by the room list and chat endpoints so expiration is enforced server-side.
 */
export async function deleteExpiredRooms(db: ReturnType<typeof getAdminSupabase>) {
  const cutoff = new Date(Date.now() - ROOM_LIFETIME_MS).toISOString();
  const { data: expiredRooms, error: findError } = await db
    .from("rooms")
    .select("id")
    .eq("status", "open")
    .lt("created_at", cutoff);

  if (findError) throw findError;
  const expiredIds = (expiredRooms ?? []).map((room) => room.id);
  if (!expiredIds.length) return 0;

  // Delete dependent chat rows first, so the cleanup works even without ON DELETE CASCADE.
  const { error: messagesError } = await db.from("messages").delete().in("room_id", expiredIds);
  if (messagesError) throw messagesError;

  const { error: roomsError } = await db
    .from("rooms")
    .delete()
    .in("id", expiredIds)
    .eq("status", "open");
  if (roomsError) throw roomsError;

  return expiredIds.length;
}
