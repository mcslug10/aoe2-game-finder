import { NextResponse } from "next/server";
import { inflateSync } from "node:zlib";

export const runtime = "nodejs";
export const revalidate = 20;

const API = "https://aoe-api.worldsedgelink.com/community/advertisement/findAdvertisements?title=age2";
type Avatar = { profile_id?: number; alias?: string; country?: string };
type MatchMember = { profile_id?: number; teamid?: number };
type Match = {
  id?: number;
  description?: string;
  mapname?: string;
  options?: string;
  maxplayers?: number;
  passwordprotected?: number;
  host_profile_id?: number;
  matchmembers?: MatchMember[];
  relayserver_region?: string;
};
type AdvertisementPage = { matches?: Match[]; avatars?: Avatar[]; result?: { code?: number; message?: string } };

const gameTypes: Record<number, string> = {
  0: "Random Map", 1: "Regicide", 2: "Death Match", 3: "Scenario",
  6: "King of the Hill", 7: "Wonder Race", 8: "Defend the Wonder",
  9: "Turbo Random Map", 10: "Capture the Relic", 11: "Sudden Death",
  12: "Battle Royale", 13: "Empire Wars", 15: "Co-Op Campaign",
};
const mapTypes: Record<number, string> = {
  10875:"Arabia",10876:"Archipelago",10877:"Baltic",10878:"Black Forest",
  10879:"Coastal",10880:"Continental",10882:"Fortress",10883:"Gold Rush",
  10885:"Islands",10895:"Arena",10897:"Oasis",10901:"Nomad",
  10914:"Acropolis",10915:"Budapest",10918:"Golden Pit",10919:"Hideout",
  10920:"Hill Fort",10921:"Lombardia",10922:"Steppe",10923:"Valley",
  10924:"MegaRandom",10945:"Michi",
};

function decodeOptions(encoded?: string): Map<number, string> {
  const values = new Map<number, string>();
  if (!encoded) return values;
  try {
    const compressed = Buffer.from(encoded, "base64");
    const unzipped = inflateSync(compressed).toString("ascii").replace(/"/g, "");
    const decoded = Buffer.from(unzipped, "base64").toString("ascii");
    for (const part of decoded.split(/[\x00-\x1f]+/)) {
      const separator = part.indexOf(":");
      if (separator <= 0) continue;
      const key = Number(part.slice(0, separator));
      if (Number.isFinite(key)) values.set(key, part.slice(separator + 1));
    }
  } catch {
    // Keep the lobby visible even if a newer game build changes the option encoding.
  }
  return values;
}

async function fetchPage(start: number): Promise<AdvertisementPage | null> {
  try {
    const response = await fetch(`${API}&start=${start}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AOE2-Game-Finder/1.0 (+https://aoe2-game-finder.vercel.app)",
      },
      next: { revalidate: 20 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return (await response.json()) as AdvertisementPage;
  } catch (error) {
    console.error("AoE2 lobby feed page", start, error);
    return null;
  }
}

export async function GET() {
  try {
    // The community endpoint is paginated. Keep the polling bounded and server-cached.
    const pages = await Promise.all([0, 100, 200].map(fetchPage));
    const validPages = pages.filter((page): page is AdvertisementPage => page !== null && Array.isArray(page.matches));
    if (!validPages.length) {
      return NextResponse.json({
        lobbies: [],
        sourceStatus: "unavailable",
        message: "O serviço global de lobbies está temporariamente indisponível.",
      });
    }

    const matches = validPages.flatMap((page) => page.matches ?? []);
    const avatars = new Map<number, Avatar>();
    for (const page of validPages) {
      for (const avatar of page.avatars ?? []) {
        if (typeof avatar.profile_id === "number") avatars.set(avatar.profile_id, avatar);
      }
    }

    const seen = new Set<string>();
    const lobbies = matches.flatMap((match) => {
      const id = String(match.id ?? "");
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const options = decodeOptions(match.options);
      const gameTypeId = Number(options.get(5));
      const mapTypeId = Number(options.get(10));
      const members = [...(match.matchmembers ?? [])].sort((a, b) =>
        Number(b.profile_id === match.host_profile_id) - Number(a.profile_id === match.host_profile_id),
      );
      const players = members.map((member) => {
        const avatar = typeof member.profile_id === "number" ? avatars.get(member.profile_id) : undefined;
        return avatar?.alias?.trim() || (member.profile_id ? `Jogador ${member.profile_id}` : "Jogador");
      });
      const capacity = Number(match.maxplayers ?? 0);
      if (capacity > 0 && players.length >= capacity) return [];
      const region = match.relayserver_region || "Global";
      return [{
        id,
        name: match.description?.trim() || "Partida sem título",
        map: mapTypes[mapTypeId] || match.mapname?.trim() || "Mapa não identificado",
        mode: gameTypes[gameTypeId] || "Modo não identificado",
        players,
        playerCount: players.length,
        slots: capacity || players.length,
        region,
        passwordProtected: Number(match.passwordprotected ?? 0) > 0,
        joinUrl: `aoe2de://0/${encodeURIComponent(id)}`,
      }];
    });

    return NextResponse.json({
      lobbies,
      sourceStatus: "ok",
      updatedAt: new Date().toISOString(),
      partial: validPages.length !== pages.length,
    });
  } catch (error) {
    console.error("public lobby browser", error);
    return NextResponse.json({
      lobbies: [],
      sourceStatus: "unavailable",
      message: "Não foi possível consultar os lobbies globais agora.",
    });
  }
}
