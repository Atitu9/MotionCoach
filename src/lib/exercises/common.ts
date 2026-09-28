import type {
  Analysis,
  Exercise,
  FormError,
  Landmarks,
} from "@/lib/pose/types";

export function issue(
  exercise: Exercise,
  id: string,
  message: string,
  joints: number[],
  timestamp: number,
  priority = 3,
): FormError {
  return {
    id,
    exercise,
    severity: priority <= 2 ? "critical" : "warning",
    message,
    joints,
    timestamp,
    confidence: 0.85,
    priority,
  };
}

export abstract class Detector {
  protected phaseSince = 0;
  protected startedAt = 0;
  protected cycleErrors = new Map<string, FormError>();
  private candidateSince = new Map<string, number>();
  abstract readonly exercise: Exercise;
  abstract phase: string;
  abstract update(
    points: Landmarks,
    now: number,
    aspect: number,
    world?: Landmarks | null,
  ): Analysis;

  reset(): void {
    this.phase = "standing";
    this.phaseSince = 0;
    this.startedAt = 0;
    this.cycleErrors.clear();
    this.candidateSince.clear();
  }

  protected enter(phase: string, now: number): void {
    this.phase = phase;
    this.phaseSince = now;
  }

  protected register(errors: FormError[], now: number): void {
    const ids = new Set(errors.map((error) => error.id));
    for (const id of this.candidateSince.keys())
      if (!ids.has(id)) this.candidateSince.delete(id);
    for (const error of errors) {
      if (!this.candidateSince.has(error.id))
        this.candidateSince.set(error.id, now);
      if (now - (this.candidateSince.get(error.id) ?? now) >= 220)
        this.cycleErrors.set(error.id, error);
    }
  }

  protected finish(valid: boolean, now: number): Analysis["attempt"] {
    const errors = Array.from(this.cycleErrors.values());
    this.cycleErrors.clear();
    this.candidateSince.clear();
    this.enter("standing", now);
    const quality = valid ? Math.max(55, 100 - errors.length * 16) : 0;
    return { valid, quality, errors };
  }
}

export function average(values: Array<number | null>): number | null {
  const valid = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
