export interface LeaderboardEntry {
  score: number;
  formScore: number;
  durationMs: number;
  date: string;
}

const KEY = "motioncoach.leaderboard.v1";

export function readLeaderboard(): LeaderboardEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LeaderboardEntry =>
          !!item &&
          typeof item === "object" &&
          Number.isFinite(item.score) &&
          Number.isFinite(item.formScore) &&
          Number.isFinite(item.durationMs) &&
          typeof item.date === "string",
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.formScore - a.formScore ||
          a.durationMs - b.durationMs,
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entry: LeaderboardEntry): LeaderboardEntry[] {
  const list = [...readLeaderboard(), entry]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.formScore - a.formScore ||
        a.durationMs - b.durationMs,
    )
    .slice(0, 5);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Storage may be disabled. */
  }
  return list;
}
