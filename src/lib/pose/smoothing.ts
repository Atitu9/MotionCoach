import { VISION } from "@/config/thresholds";
import type { Landmarks } from "./types";

export class PoseSmoother {
  private previous: Landmarks | null = null;

  update(current: Landmarks): Landmarks {
    const alpha = VISION.smoothingAlpha;
    if (!this.previous || this.previous.length !== current.length) {
      this.previous = current.map((point) => ({ ...point }));
      return this.previous;
    }
    const next = current.map((point, i) => {
      const prior = this.previous![i];
      if ((point.visibility ?? 1) < VISION.minVisibility) return { ...point };
      if ((prior.visibility ?? 1) < VISION.minVisibility) return { ...point };
      return {
        ...point,
        x: alpha * point.x + (1 - alpha) * prior.x,
        y: alpha * point.y + (1 - alpha) * prior.y,
        z: alpha * (point.z ?? 0) + (1 - alpha) * (prior.z ?? 0),
      };
    });
    this.previous = next;
    return next;
  }

  reset(): void {
    this.previous = null;
  }
}
