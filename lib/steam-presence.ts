import { companionGet } from "@/lib/aoe2-coach";

export type SteamPresenceState =
  | "online"
  | "offline"
  | "busy"
  | "away"
  | "snooze"
  | "looking_to_trade"
  | "looking_to_play"
  | "private"
  | "not_found"
  | "no_steam_id"
  | "not_configured"
  | "error";

export type SteamPresence = {
  profileId: number;
  steamId: string | null;
  state: SteamPresenceState;
  personaName?: string;
  avatar?: string;
  lastLogoff?: number;
  checkedAt: string;
};

type CompanionProfileForSteam = {
  profileId?: number;
  name?: string;
  steamId?: string | number | null;
};

type SteamPlayerSummary = {
  steamid?: string;
  personaname?: string;
  personastate?: number;
  communityvisibilitystate?: number;
  avatarfull?: string;
  lastlogoff?: number;
};

function stateFromSteam(player: SteamPlayerSummary): SteamPresenceState {
  // Private/friends-only profiles must not be reported as offline just because
  // Steam masks their persona state as zero.
  if (player.communityvisibilitystate !== 3) return "private";
  switch (Number(player.personastate)) {
    case 0: return "offline";
    case 1: return "online";
    case 2: return "busy";
    case 3: return "away";
    case 4: return "snooze";
    case 5: return "looking_to_trade";
    case 6: return "looking_to_play";
    default: return "error";
  }
}

export async function getSteamPresenceForProfileIds(profileIds: number[]): Promise<SteamPresence[]> {
  const uniqueIds = [...new Set(profileIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const checkedAt = new Date().toISOString();
  const apiKey = process.env.STEAM_WEB_API_KEY?.trim();

  if (!apiKey) {
    return uniqueIds.map((profileId) => ({
      profileId, steamId: null, state: "not_configured", checkedAt,
    }));
  }

  const profiles = await Promise.all(uniqueIds.map(async (profileId) => {
    try {
      const payload = await companionGet(`profiles/${profileId}`, { language: "en", page: "1" });
      const profile = payload as CompanionProfileForSteam;
      const steamId = profile.steamId == null ? "" : String(profile.steamId).trim();
      return { profileId, steamId: /^\d{16,20}$/.test(steamId) ? steamId : null, lookupFailed: false };
    } catch {
      return { profileId, steamId: null, lookupFailed: true };
    }
  }));

  const withSteamIds = profiles.filter((profile): profile is { profileId: number; steamId: string; lookupFailed: false } => Boolean(profile.steamId));
  if (!withSteamIds.length) {
    return uniqueIds.map((profileId) => ({
      profileId, steamId: null,
      state: profile?.lookupFailed ? "error" : "no_steam_id",
      checkedAt,
    }));
  }

  const summaries: SteamPlayerSummary[] = [];
  try {
    // Steam accepts at most 100 SteamIDs per GetPlayerSummaries call.
    for (let start = 0; start < withSteamIds.length; start += 100) {
      const batch = withSteamIds.slice(start, start + 100);
      const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("steamids", batch.map((profile) => profile.steamId).join(","));

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 45 },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Steam API HTTP ${response.status}`);
      const payload = await response.json() as { response?: { players?: SteamPlayerSummary[] } };
      summaries.push(...(payload.response?.players ?? []));
    }
  } catch (error) {
    console.error("Steam presence lookup failed", error instanceof Error ? error.message : String(error));
    return uniqueIds.map((profileId) => {
      const profile = profiles.find((item) => item.profileId === profileId);
      return {
        profileId, steamId: profile?.steamId ?? null, state: "error", checkedAt,
      };
    });
  }

  const bySteamId = new Map(summaries.map((player) => [String(player.steamid ?? ""), player]));
  const byProfileId = new Map(withSteamIds.map((profile) => [profile.profileId, profile.steamId]));

  return uniqueIds.map((profileId) => {
    const steamId = byProfileId.get(profileId) ?? null;
    if (!steamId) {
      const profile = profiles.find((item) => item.profileId === profileId);
      return { profileId, steamId: null, state: profile?.lookupFailed ? "error" : "no_steam_id", checkedAt };
    }
    const player = bySteamId.get(steamId);
    if (!player) return { profileId, steamId, state: "not_found", checkedAt };
    return {
      profileId,
      steamId,
      state: stateFromSteam(player),
      personaName: player.personaname,
      avatar: player.avatarfull,
      lastLogoff: player.lastlogoff,
      checkedAt,
    };
  });
}
