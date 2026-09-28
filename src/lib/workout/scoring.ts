import type { Exercise, RepResult } from "@/lib/pose/types";

export function scoreRep(rep: RepResult): number {
  if (!rep.valid) return 0;
  return 100 + (rep.quality >= 90 ? 25 : 0);
}

export function formScore(reps: RepResult[]): number {
  const valid = reps.filter((rep) => rep.valid);
  if (!valid.length) return 100;
  const average =
    valid.reduce((sum, rep) => sum + rep.quality, 0) / valid.length;
  const invalidPenalty = (reps.length - valid.length) * 3;
  return Math.max(0, Math.min(100, Math.round(average - invalidPenalty)));
}

export function exerciseForm(reps: RepResult[], exercise: Exercise): number {
  return formScore(reps.filter((rep) => rep.exercise === exercise));
}

export function scoreBreakdown(reps: RepResult[]): Record<Exercise, number> {
  return {
    squat: reps
      .filter((rep) => rep.exercise === "squat")
      .reduce((sum, rep) => sum + scoreRep(rep), 0),
    lunge: reps
      .filter((rep) => rep.exercise === "lunge")
      .reduce((sum, rep) => sum + scoreRep(rep), 0),
    jumpingJack: reps
      .filter((rep) => rep.exercise === "jumpingJack")
      .reduce((sum, rep) => sum + scoreRep(rep), 0),
  };
}

export function errorsCorrected(reps: RepResult[]): number {
  const corrected = new Set<string>();
  const seen = new Set<string>();
  for (const rep of reps) {
    const ids = new Set(rep.errors.map((error) => error.id));
    if (rep.valid) {
      for (const id of seen) if (!ids.has(id)) corrected.add(id);
    }
    for (const id of ids) seen.add(id);
  }
  return corrected.size;
}
