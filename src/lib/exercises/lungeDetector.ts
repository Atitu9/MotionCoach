import { LUNGE } from "@/config/thresholds";
import {
  calculateAngle,
  calculateAngle3D,
  distance,
  midpoint,
} from "@/lib/pose/geometry";
import { POSE, type Analysis, type Landmarks } from "@/lib/pose/types";
import { Detector, issue } from "./common";

export class LungeDetector extends Detector {
  readonly exercise = "lunge" as const;
  phase = "standing";
  private minAngle = 180;
  private reachedDepth = false;

  override reset(): void {
    super.reset();
    this.minAngle = 180;
    this.reachedDepth = false;
  }

  update(
    p: Landmarks,
    now: number,
    aspect: number,
    world?: Landmarks | null,
  ): Analysis {
    const left =
      world?.length === p.length
        ? calculateAngle3D(
            world[POSE.leftHip],
            world[POSE.leftKnee],
            world[POSE.leftAnkle],
          )
        : calculateAngle(
            p[POSE.leftHip],
            p[POSE.leftKnee],
            p[POSE.leftAnkle],
            aspect,
          );
    const right =
      world?.length === p.length
        ? calculateAngle3D(
            world[POSE.rightHip],
            world[POSE.rightKnee],
            world[POSE.rightAnkle],
          )
        : calculateAngle(
            p[POSE.rightHip],
            p[POSE.rightKnee],
            p[POSE.rightAnkle],
            aspect,
          );
    if (left === null || right === null)
      return {
        phase: this.phase,
        cue: "Keep both legs visible.",
        errors: [],
        debug: {},
      };
    const flexed = Math.min(left, right);
    const asymmetry = Math.abs(left - right);
    const shoulders = midpoint(p[POSE.leftShoulder], p[POSE.rightShoulder]);
    const hips = midpoint(p[POSE.leftHip], p[POSE.rightHip]);
    const shoulderWidth = distance(
      p[POSE.leftShoulder],
      p[POSE.rightShoulder],
      aspect,
    );
    const offset =
      shoulderWidth > 0
        ? (Math.abs(shoulders.x - hips.x) * aspect) / shoulderWidth
        : 0;
    const errors = [];
    if (this.phase !== "standing" && offset > LUNGE.torsoOffsetRatio)
      errors.push(
        issue(
          "lunge",
          "lunge_balance",
          "Keep your torso centered over your hips.",
          [POSE.leftShoulder, POSE.rightShoulder, POSE.leftHip, POSE.rightHip],
          now,
        ),
      );
    this.register(errors, now);

    let attempt: Analysis["attempt"];
    if (
      this.phase === "standing" &&
      flexed < LUNGE.startAngle &&
      asymmetry > LUNGE.minAsymmetryDegrees
    ) {
      this.enter("descending", now);
      this.startedAt = now;
      this.minAngle = flexed;
      this.reachedDepth = false;
    } else if (this.phase === "descending") {
      this.minAngle = Math.min(this.minAngle, flexed);
      if (
        flexed < LUNGE.bottomAngle &&
        asymmetry > LUNGE.minAsymmetryDegrees &&
        now - this.phaseSince >= LUNGE.minPhaseMs
      ) {
        this.reachedDepth = true;
        this.enter("bottom", now);
      } else if (flexed > this.minAngle + LUNGE.shallowTurnDegrees) {
        this.enter("ascending", now);
      }
    } else if (
      this.phase === "bottom" &&
      flexed > LUNGE.bottomAngle + 18 &&
      now - this.phaseSince >= LUNGE.minPhaseMs
    ) {
      this.enter("ascending", now);
    } else if (this.phase === "ascending") {
      if (
        left > LUNGE.standingAngle &&
        right > LUNGE.standingAngle &&
        now - this.startedAt >= LUNGE.minRepMs
      ) {
        if (!this.reachedDepth)
          this.cycleErrors.set(
            "shallow_lunge",
            issue(
              "lunge",
              "shallow_lunge",
              "Lower your hips a little more to complete the lunge.",
              [POSE.leftKnee, POSE.rightKnee],
              now,
            ),
          );
        attempt = this.finish(this.reachedDepth, now);
      } else if (flexed < LUNGE.bottomAngle - 4) {
        this.reachedDepth = true;
        this.enter("bottom", now);
      }
    }
    const cue =
      this.phase === "bottom"
        ? "Push back to standing."
        : this.phase === "descending"
          ? "Lower into the lunge."
          : this.phase === "ascending"
            ? "Return to a tall stance."
            : "Step into a lunge; alternate sides.";
    return {
      phase: this.phase,
      cue,
      errors,
      attempt,
      debug: {
        leftKnee: Math.round(left),
        rightKnee: Math.round(right),
        torsoOffset: offset.toFixed(2),
      },
    };
  }
}
