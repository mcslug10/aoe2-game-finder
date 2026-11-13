import { NextResponse } from "next/server";
import { inflateSync } from "node:zlib";

export const runtime = "nodejs";
export const revalidate = 20;

const API_HOSTS = [
  "https://aoe-api.worldsedgelink.com",
  "https://aoe-api.reliclink.com",
];
const PAGE_SIZE = 100;
const MAX_PAGES = 6;

type Avatar = { profile_id?: number; alias?: string; name?: string; country?: string };
type MatchMember = { profile_id?: number; teamid?: number };
type Match = {
  id?: number | string;
  description?: string;
  mapname?: string;
  options?: string;
  maxplayers?: number;
  passwordprotected?: number | boolean;
  host_profile_id?: number;
  matchmembers?: MatchMember[];
  relayserver_region?: string;
  game_type?: number;
  map_type?: number;
};
type AdvertisementPage = {
  result?: { code?: number; message?: string };
  matches?: Match[];
  avatars?: Avatar[];
};

const GAME_TYPES: Record<number, string> = {
  0: "Random Map", 1: "Regicide", 2: "Death Match", 3: "Scenario",
  6: "King of the Hill", 7: "Wonder Race", 8: "Defend the Wonder",
  9: "Turbo Random Map", 10: "Capture the Relic", 11: "Sudden Death",
  12: "Battle Royale", 13: "Empire Wars", 15: "Co-Op Campaign",
};
const MAP_TYPES: Record<number, string> = {
  10875:"Arabia",10876:"Archipelago",10877:"Baltic",10878:"Black Forest",
  10879:"Coastal",10880:"Continental",10881:"Crater Lake",10882:"Fortress",
  10883:"Gold Rush",10884:"Highland",10885:"Islands",10886:"Mediterranean",
  10887:"Migration",10888:"Rivers",10889:"Team Islands",10895:"Arena",
  10897:"Oasis",10901:"Nomad",10914:"Acropolis",10915:"Budapest",
  10916:"Cenotes",10917:"City of Lakes",10918:"Golden Pit",10919:"Hideout",
  10920:"Hill Fort",10921:"Lombardia",10922:"Steppe",10923:"Valley",
  10924:"MegaRandom",10945:"Michi",10930:"Golden Swamp",10931:"Four Lakes",
  10932:"Land Nomad",10947:"Volcanic Island",10948:"Acclivity",
  10949:"Eruption",10950:"Frigid Lake",10951:"Greenland",10952:"Lowland",
  10953:"Marketplace",10954:"Meadow",10955:"Mountain Range",10956:"Northern Isles",
  10957:"Ring Fortress",10958:"Runestones",10959:"Aftermath",10960:"Enclosed",
};

function decodeOptions(encoded?: string): Map<number, string> {
  const values = new Map<number, string>();
  if (!encoded) return values;

  try {
    // AoE2:DE encodes its lobby options as base64(zlib(base64(option-string))).
    const compressed = Buffer.from(encoded, "base64");
    const unzipped = inflateSync(compressed).toString("ascii").replace(/"/g, "");
    const decoded = Buffer.from(unzipped, "base64").toString("ascii");
    for (const entry of decoded.split(/[\x00-\x1f]+/)) {
      const separator = entry.indexOf(":");
      if (separator <= 0) continue;
      const key = Number(entry.slice(0, separator));
      if (Number.isInteger(key)) values.set(key, entry.slice(separator + 1));
    }
  } catch {
    // Unknown/newer option encodings should not hide the lobby itself.
  }

  return values;
}

async function fetchPage(start: number): Promise<AdvertisementPage | null> {
  for (const host of API_HOSTS) {
    try {
      const response = await fetch(
        `${host}/community/advertisement/findAdvertisements?title=age2&start=${start}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "AOE2-Game-Finder/1.0 (community lobby browser; https://aoe2-game-finder.vercel.app)",
          },
          next: { revalidate: 20 },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) continue;
      const payload = (await response.json()) as AdvertisementPage;
      if (Array.isArray(payload.matches)) return payload;
    } catch (error) {
      console.error("AoE2 lobby feed request", host, start, error);
    }
  }

  return null;
}

function humanRegion(region?: string): string {
  if (!region) return "Global";
  const names: Record<string, string> = {
    brazilsouth: "Brasil", eastus: "América do Norte",
    westus3: "América do Norte", westeurope: "Europa",
    ukwest: "Reino Unido", koreacentral: "Coreia",
    southeastasia: "Sudeste Asiático", australiasoutheast: "Austrália",
    centralindia: "Índia",
  };
  return names[region.toLowerCase()] ?? region;
}

export async function GET() {
  try {
    // Fetch the first pages together, then continue only if the last page is full.
    const firstStarts = [0, PAGE_SIZE, PAGE_SIZE * 2];
    const firstPages = await Promise.all(firstStarts.map(fetchPage));
    const pages = firstPages.filter((page): page is AdvertisementPage => page !== null);
    if (pages.length === 0) {
      return NextResponse.json({
        lobbies: [],
        sourceStatus: "unavailable",
        message: "O serviço global de lobbies está temporariamente indisponível.",
      });
    }

    let nextStart = PAGE_SIZE * 3;
    let lastPage = firstPages[firstPages.length - 1];
    while (lastPage && (lastPage.matches?.length ?? 0) >= PAGE_SIZE && nextStart < PAGE_SIZE * MAX_PAGES) {
      const page = await fetchPage(nextStart);
      if (!page) break;
      pages.push(page);
      lastPage = page;
      nextStart += PAGE_SIZE;
    }

    const avatars = new Map<number, Avatar>();
    const matches = new Map<string, Match>();

    for (const page of pages) {
      for (const avatar of page.avatars ?? []) {
        if (typeof avatar.profile_id === "number") avatars.set(avatar.profile_id, avatar);
      }
      for (const match of page.matches ?? []) {
        const id = String(match.id ?? "");
        if (id) matches.set(id, match);
      }
    }

    const lobbies = Array.from(matches.values()).flatMap((match) => {
      const id = String(match.id ?? "");
      if (!id) return [];

      const options = decodeOptions(match.options);
      const gameTypeId = Number(options.get(5) ?? match.game_type);
      const mapTypeId = Number(options.get(10) ?? match.map_type);
      const members = [...(match.matchmembers ?? [])].sort((a, b) =>
        Number(b.profile_id === match.host_profile_id) - Number(a.profile_id === match.host_profile_id),
      );

      const players = members.map((member) => {
        const avatar = typeof member.profile_id === "number" ? avatars.get(member.profile_id) : undefined;
        return avatar?.alias?.trim() || avatar?.name?.trim() || (member.profile_id ? `Jogador ${member.profile_id}` : "Jogador");
      });

      const capacity = Number(match.maxplayers ?? 0);
      if (capacity > 0 && players.length >= capacity) return [];

      const slots = capacity > 0 ? capacity : Math.max(players.length + 1, 2);
      return [{
        id,
        name: match.description?.trim() || "Partida sem título",
        map: MAP_TYPES[mapTypeId] || match.mapname?.trim() || "Mapa não identificado",
        mode: GAME_TYPES[gameTypeId] || "Modo não identificado",
        players,
        playerCount: players.length,
        slots,
        region: humanRegion(match.relayserver_region),
        passwordProtected: match.passwordprotected === true || Number(match.passwordprotected ?? 0) > 0,
        joinUrl: `aoe2de://0/${encodeURIComponent(id)}`,
      }];
    });

    return NextResponse.json({
      lobbies,
      sourceStatus: "ok",
      updatedAt: new Date().toISOString(),
      pagesLoaded: pages.length,
    });
  } catch (error) {
    console.error("public AoE2 lobby browser", error);
    return NextResponse.json({
      lobbies: [],
      sourceStatus: "unavailable",
      message: "Não foi possível consultar os lobbies globais agora.",
    });
  }
}
