import { JACK } from "@/config/thresholds";
import { distance } from "@/lib/pose/geometry";
import { POSE, type Analysis, type Landmarks } from "@/lib/pose/types";
import { Detector, issue } from "./common";

export class JumpingJackDetector extends Detector {
  readonly exercise = "jumpingJack" as const;
  phase = "closed";
  private openReached = false;

  override reset(): void {
    super.reset();
    this.phase = "closed";
    this.openReached = false;
  }

  update(p: Landmarks, now: number, aspect: number): Analysis {
    const shoulderWidth = distance(
      p[POSE.leftShoulder],
      p[POSE.rightShoulder],
      aspect,
    );
    const feetRatio =
      shoulderWidth > 0.02
        ? distance(p[POSE.leftAnkle], p[POSE.rightAnkle], aspect) /
          shoulderWidth
        : 0;
    const shoulderY = (p[POSE.leftShoulder].y + p[POSE.rightShoulder].y) / 2;
    const wristsY = Math.max(p[POSE.leftWrist].y, p[POSE.rightWrist].y);
    const armsHigh = wristsY < shoulderY - JACK.armsHighOffset;
    const armsLow =
      Math.min(p[POSE.leftWrist].y, p[POSE.rightWrist].y) >
      shoulderY + JACK.armsLowOffset;
    const feetWide = feetRatio > JACK.openFeetRatio;
    const feetClosed = feetRatio < JACK.closedFeetRatio;
    const errors = [];
    if (this.phase !== "closed" && feetWide && !armsHigh)
      errors.push(
        issue(
          "jumpingJack",
          "arms_low",
          "Raise your hands higher to complete the jumping jack.",
          [POSE.leftWrist, POSE.rightWrist],
          now,
        ),
      );
    if (this.phase !== "closed" && armsHigh && !feetWide)
      errors.push(
        issue(
          "jumpingJack",
          "feet_narrow",
          "Step your feet wider.",
          [POSE.leftAnkle, POSE.rightAnkle],
          now,
        ),
      );
    this.register(errors, now);

    let attempt: Analysis["attempt"];
    if (this.phase === "closed" && (armsHigh || feetWide) && !feetClosed) {
      this.enter("opening", now);
      this.startedAt = now;
      this.openReached = false;
    } else if (this.phase === "closed" && armsHigh && feetClosed) {
      this.enter("opening", now);
      this.startedAt = now;
      this.openReached = false;
    } else if (this.phase === "opening") {
      if (armsHigh && feetWide && now - this.phaseSince >= JACK.minPhaseMs) {
        this.openReached = true;
        this.enter("open", now);
      } else if (
        armsLow &&
        feetClosed &&
        now - this.startedAt >= JACK.minRepMs
      ) {
        attempt = this.finish(false, now);
        this.phase = "closed";
      }
    } else if (
      this.phase === "open" &&
      (!armsHigh || !feetWide) &&
      now - this.phaseSince >= JACK.minPhaseMs
    ) {
      this.enter("closing", now);
    } else if (this.phase === "closing") {
      if (armsLow && feetClosed && now - this.startedAt >= JACK.minRepMs) {
        attempt = this.finish(this.openReached, now);
        this.phase = "closed";
      } else if (
        armsHigh &&
        feetWide &&
        now - this.phaseSince >= JACK.minPhaseMs
      ) {
        errors.push(
          issue(
            "jumpingJack",
            "incomplete_close",
            "Bring your arms down and feet together before the next rep.",
            [POSE.leftWrist, POSE.rightWrist, POSE.leftAnkle, POSE.rightAnkle],
            now,
          ),
        );
        this.enter("open", now);
      }
    }
    const cue =
      this.phase === "open"
        ? "Now bring your hands down and feet together."
        : this.phase === "opening"
          ? "Hands up and feet wide."
          : this.phase === "closing"
            ? "Close fully to finish the rep."
            : "Jump or step out with hands overhead.";
    return {
      phase: this.phase,
      cue,
      errors,
      attempt,
      debug: { feetRatio: feetRatio.toFixed(2), armsHigh: String(armsHigh) },
    };
  }
}
