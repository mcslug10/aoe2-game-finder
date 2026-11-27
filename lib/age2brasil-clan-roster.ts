/**
 * AGE2BRASIL clan roster resolved from in-game names using the community
 * World's Edge/Relic Link personal-stat lookup (aliases -> profile_id).
 * Keep uncertain identities disabled until a clan admin confirms them.
 * Last checked: 2026-11-27.
 */
export type ClanRosterMember = {
  nickname: string;
  profileId: number | null;
  status: "verified" | "needs_confirmation";
  note?: string;
};

export const AGE2BRASIL_CLAN = {
  name: "AGE2BRASIL",
  tag: "BRTIM",
  founder: "[BRTIM] PUTO",
  members: [
    { nickname: "PaiSlug", profileId: 26108844, status: "verified" },
    { nickname: "cardosoiury", profileId: 1629959, status: "verified" },
    { nickname: "MelioDaS", profileId: 2374161, status: "verified" },
    { nickname: "KannYahoo", profileId: 2724542, status: "verified" },
    { nickname: "BRTIM Dominus", profileId: 3090052, status: "verified" },
    { nickname: "[BRTIM] FASNIS", profileId: 4397944, status: "verified" },
    { nickname: "Totalys", profileId: 5429339, status: "verified" },
    { nickname: "alexandrecco", profileId: 9184200, status: "verified" },
    { nickname: "BOM DE MIRA", profileId: 11467761, status: "verified" },
    { nickname: "Balanar", profileId: 14607275, status: "verified", note: "Encontrado um perfil com clanlist_name BRTIM; conferir com o membro antes de ativar." },
    { nickname: "[BRTIM] TrOgEbA", profileId: 16140880, status: "verified" },
    { nickname: "brunoftino", profileId: 16780060, status: "verified" },
    { nickname: "[BRTIM] PUTO", profileId: 19316760, status: "verified" },
    { nickname: "[BRTIM] Mago Negro", profileId: null, status: "needs_confirmation", note: "A busca exata não retornou perfil; variantes 'Mago Negro' retornaram homônimos sem clan tag confirmável." },
    { nickname: "Adriano BR", profileId: 23941100, status: "verified" },
    { nickname: "Jack Sparrow Nordestino", profileId: 24030796, status: "verified" },
    { nickname: "VeRgA", profileId: 24590869, status: "verified" },
    { nickname: "Nordestino", profileId: 24846728, status: "verified" },
  ] satisfies ClanRosterMember[],
} as const;
