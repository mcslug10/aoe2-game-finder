export type TrackedPlayer = {
  profileId: number;
  nickname: string;
};

/**
 * Players followed in the Game Finder presence panel.
 * Add new players here using their Relic/AoE2 profile ID.
 */
export const TRACKED_PLAYERS: TrackedPlayer[] = [
  { nickname: "PaiSlug", profileId: 26108844 },
];
