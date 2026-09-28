import { SQUAT } from "@/config/thresholds";
import {
  calculateAngle,
  calculateAngle3D,
  midpoint,
  torsoForwardLean,
} from "@/lib/pose/geometry";
import { POSE, type Analysis, type Landmarks } from "@/lib/pose/types";
import { average, Detector, issue } from "./common";

export class SquatDetector extends Detector {
  readonly exercise = "squat" as const;
  phase = "standing";
  private minAngle = 180;
  private reachedBottom = false;

  override reset(): void {
    super.reset();
    this.minAngle = 180;
    this.reachedBottom = false;
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
    const knee = average([left, right]);
    if (knee === null)
      return {
        phase: this.phase,
        cue: "Keep both legs in frame.",
        errors: [],
        debug: {},
      };
    const worldShoulders =
      world?.length === p.length
        ? midpoint(world[POSE.leftShoulder], world[POSE.rightShoulder])
        : null;
    const worldHips =
      world?.length === p.length
        ? midpoint(world[POSE.leftHip], world[POSE.rightHip])
        : null;
    const lean =
      worldShoulders && worldHips
        ? torsoForwardLean(worldShoulders, worldHips)
        : 0;
    const errors = [];
    if (
      this.phase !== "standing" &&
      worldShoulders &&
      worldHips &&
      lean > SQUAT.torsoLeanDegrees
    )
      errors.push(
        issue(
          "squat",
          "torso_lean",
          "Keep your chest up — your torso is leaning too far forward.",
          [POSE.leftShoulder, POSE.rightShoulder, POSE.leftHip, POSE.rightHip],
          now,
        ),
      );
    if (
      this.phase !== "standing" &&
      left !== null &&
      right !== null &&
      Math.abs(left - right) > SQUAT.kneeAsymmetryDegrees
    )
      errors.push(
        issue(
          "squat",
          "knee_asymmetry",
          "Keep both knees stable and move evenly.",
          [POSE.leftKnee, POSE.rightKnee],
          now,
          4,
        ),
      );
    this.register(errors, now);

    let attempt: Analysis["attempt"];
    if (this.phase === "standing" && knee < SQUAT.startAngle) {
      this.enter("descending", now);
      this.startedAt = now;
      this.minAngle = knee;
      this.reachedBottom = false;
    } else if (this.phase === "descending") {
      this.minAngle = Math.min(this.minAngle, knee);
      if (
        knee < SQUAT.bottomAngle &&
        now - this.phaseSince >= SQUAT.minPhaseMs
      ) {
        this.reachedBottom = true;
        this.enter("bottom", now);
      } else if (knee > this.minAngle + SQUAT.shallowTurnDegrees) {
        this.enter("ascending", now);
      }
    } else if (
      this.phase === "bottom" &&
      knee > SQUAT.ascentAngle &&
      now - this.phaseSince >= SQUAT.minPhaseMs
    ) {
      this.enter("ascending", now);
    } else if (this.phase === "ascending") {
      if (
        knee > SQUAT.standingAngle &&
        now - this.startedAt >= SQUAT.minRepMs
      ) {
        if (!this.reachedBottom)
          this.cycleErrors.set(
            "shallow_squat",
            issue(
              "squat",
              "shallow_squat",
              "Go lower — bend your knees more to complete the squat.",
              [POSE.leftKnee, POSE.rightKnee],
              now,
              3,
            ),
          );
        attempt = this.finish(this.reachedBottom, now);
      } else if (knee < SQUAT.bottomAngle - 4) {
        this.reachedBottom = true;
        this.enter("bottom", now);
      }
    }
    const cue =
      this.phase === "bottom"
        ? "Drive upward with control."
        : this.phase === "descending"
          ? "Lower until your knees bend deeply."
          : this.phase === "ascending"
            ? "Stand tall to finish the rep."
            : "Bend your knees to begin.";
    return {
      phase: this.phase,
      cue,
      errors,
      attempt,
      debug: {
        leftKnee: Math.round(left ?? 0),
        rightKnee: Math.round(right ?? 0),
        torsoAngle: Math.round(lean),
      },
    };
  }
}
