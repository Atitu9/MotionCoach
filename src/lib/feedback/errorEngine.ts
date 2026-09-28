import { VISION } from "@/config/thresholds";
import type { FormError } from "@/lib/pose/types";

export class ErrorEngine {
  private pending = new Map<string, number>();
  private lastShown = new Map<string, number>();
  private current: FormError | null = null;
  private currentUntil = 0;

  update(candidates: FormError[], now: number): FormError | null {
    const ids = new Set(candidates.map((item) => item.id));
    for (const id of this.pending.keys())
      if (!ids.has(id)) this.pending.delete(id);
    for (const error of candidates) {
      if (!this.pending.has(error.id)) this.pending.set(error.id, now);
    }
    const stable = candidates
      .filter(
        (error) =>
          now - (this.pending.get(error.id) ?? now) >=
          VISION.feedbackPersistenceMs,
      )
      .sort((a, b) => a.priority - b.priority);
    const next = stable[0];
    if (
      next &&
      (this.current?.id === next.id ||
        now - (this.lastShown.get(next.id) ?? -Infinity) >=
          VISION.feedbackCooldownMs)
    ) {
      this.current = next;
      this.currentUntil = now + 850;
      this.lastShown.set(next.id, now);
    } else if (now > this.currentUntil) {
      this.current = null;
    }
    return this.current;
  }

  reset(): void {
    this.pending.clear();
    this.lastShown.clear();
    this.current = null;
    this.currentUntil = 0;
  }
}
