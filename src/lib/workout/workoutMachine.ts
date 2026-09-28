import { TARGETS, VISION } from "@/config/thresholds";
import { JumpingJackDetector } from "@/lib/exercises/jumpingJackDetector";
import { LungeDetector } from "@/lib/exercises/lungeDetector";
import { SquatDetector } from "@/lib/exercises/squatDetector";
import { ErrorEngine } from "@/lib/feedback/errorEngine";
import { PoseSmoother } from "@/lib/pose/smoothing";
import { setupStatus, reliable, requiredFor } from "@/lib/pose/visibility";
import {
  POSE,
  type Exercise,
  type FormError,
  type Landmarks,
  type RepResult,
  type WorkoutSnapshot,
  type WorkoutStage,
} from "@/lib/pose/types";
import { formScore, scoreRep } from "./scoring";

const ORDER: Exercise[] = ["squat", "lunge", "jumpingJack"];
const STAGES: Record<Exercise, WorkoutStage> = {
  squat: "squat",
  lunge: "lunge",
  jumpingJack: "jumpingJack",
};

export class WorkoutMachine {
  private stage: WorkoutStage = "landing";
  private stageSince = 0;
  private workoutStarted = 0;
  private workoutEnded = 0;
  private readySince = 0;
  private gestureSince = 0;
  private lostSince = 0;
  private lastErrorId = "";
  private reps: RepResult[] = [];
  private counts: Record<Exercise, number> = {
    squat: 0,
    lunge: 0,
    jumpingJack: 0,
  };
  private score = 0;
  private phase = "standing";
  private cue = "Position your full body inside the frame.";
  private primaryError: FormError | null = null;
  private setupMessage = "Position your full body inside the frame.";
  private setupProgress = 0;
  private gestureProgress = 0;
  private tracking = false;
  private debug: Record<string, string | number> = {};
  private event: WorkoutSnapshot["event"] = null;
  private smoother = new PoseSmoother();
  private worldSmoother = new PoseSmoother();
  private feedback = new ErrorEngine();
  private detectors = {
    squat: new SquatDetector(),
    lunge: new LungeDetector(),
    jumpingJack: new JumpingJackDetector(),
  };

  getStage(): WorkoutStage {
    return this.stage;
  }

  requestCamera(now = performance.now()): void {
    this.enter("camera_permission", now);
  }
  cameraReady(now = performance.now()): void {
    this.enter("camera_setup", now);
  }

  private enter(stage: WorkoutStage, now: number): void {
    this.stage = stage;
    this.stageSince = now;
    this.gestureSince = 0;
    this.gestureProgress = 0;
    this.feedback.reset();
    this.primaryError = null;
    this.lastErrorId = "";
  }

  start(now = performance.now()): void {
    if (this.stage === "ready" && this.setupProgress >= 1)
      this.enter("countdown", now);
  }

  restart(now = performance.now()): void {
    if (this.stage !== "results") return;
    this.reps = [];
    this.counts = { squat: 0, lunge: 0, jumpingJack: 0 };
    this.score = 0;
    this.workoutStarted = 0;
    this.workoutEnded = 0;
    this.readySince = 0;
    this.setupProgress = 0;
    this.phase = "standing";
    this.smoother.reset();
    this.worldSmoother.reset();
    Object.values(this.detectors).forEach((detector) => detector.reset());
    this.enter("camera_setup", now);
  }

  private exercise(): Exercise | null {
    return this.stage === "squat" ||
      this.stage === "lunge" ||
      this.stage === "jumpingJack"
      ? this.stage
      : null;
  }

  update(
    raw: Landmarks | null,
    now: number,
    aspect: number,
    rawWorld?: Landmarks | null,
  ): WorkoutSnapshot {
    this.event = null;
    const points = raw?.length ? this.smoother.update(raw) : null;
    const world = rawWorld?.length ? this.worldSmoother.update(rawWorld) : null;
    const status = setupStatus(points);
    this.tracking = status.ready;
    this.setupMessage = status.message;
    this.debug = { landmarkConfidence: status.confidence.toFixed(2) };

    if (this.stage === "camera_setup" || this.stage === "ready") {
      if (status.ready) {
        if (!this.readySince) this.readySince = now;
        this.setupProgress = Math.min(
          1,
          (now - this.readySince) / VISION.setupStableMs,
        );
        if (this.stage === "camera_setup" && this.setupProgress >= 1)
          this.enter("ready", now);
      } else {
        this.readySince = 0;
        this.setupProgress = 0;
        if (this.stage === "ready") this.enter("camera_setup", now);
      }
    }

    if (this.stage === "ready" || this.stage === "results") {
      const handsVisible = reliable(points, [
        POSE.leftWrist,
        POSE.rightWrist,
        POSE.leftShoulder,
        POSE.rightShoulder,
      ]);
      const overhead =
        handsVisible &&
        !!points &&
        points[POSE.leftWrist].y < points[POSE.leftShoulder].y - 0.09 &&
        points[POSE.rightWrist].y < points[POSE.rightShoulder].y - 0.09;
      if (overhead) {
        if (!this.gestureSince) this.gestureSince = now;
        this.gestureProgress = Math.min(
          1,
          (now - this.gestureSince) / VISION.gestureHoldMs,
        );
        if (this.gestureProgress >= 1) {
          if (this.stage === "ready") this.start(now);
          else this.restart(now);
        }
      } else {
        this.gestureSince = 0;
        this.gestureProgress = 0;
      }
    }

    if (this.stage === "countdown" && now - this.stageSince >= 3000) {
      this.workoutStarted = now;
      this.detectors.squat.reset();
      this.enter("squat", now);
    }
    if (this.stage === "transition" && now - this.stageSince >= 2400) {
      const next = ORDER.find((item) => this.counts[item] < TARGETS[item]);
      if (next) {
        this.detectors[next].reset();
        this.enter(STAGES[next], now);
      }
    }
    if (this.stage === "complete" && now - this.stageSince >= 1600)
      this.enter("results", now);

    const exercise = this.exercise();
    if (exercise) {
      const needed = requiredFor(exercise);
      if (!reliable(points, needed)) {
        if (!this.lostSince) this.lostSince = now;
        if (now - this.lostSince > VISION.lostTrackingResetMs)
          this.detectors[exercise].reset();
        this.phase = "tracking lost";
        this.primaryError = {
          id: "visibility",
          exercise,
          severity: "critical",
          message: status.ready
            ? "Keep your whole body visible to count reps."
            : status.message,
          joints: needed,
          timestamp: now,
          confidence: 1,
          priority: 0,
        };
      } else if (points) {
        this.lostSince = 0;
        const result = this.detectors[exercise].update(
          points,
          now,
          aspect,
          world,
        );
        this.phase = result.phase;
        this.cue = result.cue;
        this.debug = {
          ...this.debug,
          ...result.debug,
          detectorState: result.phase,
        };
        this.primaryError = this.feedback.update(result.errors, now);
        if (this.primaryError && this.primaryError.id !== this.lastErrorId) {
          this.event = "warning";
          this.lastErrorId = this.primaryError.id;
        } else if (!this.primaryError) this.lastErrorId = "";
        if (result.attempt) {
          const rep: RepResult = {
            exercise,
            repNumber: this.counts[exercise] + (result.attempt.valid ? 1 : 0),
            valid: result.attempt.valid,
            quality: result.attempt.quality,
            errors: result.attempt.errors,
            timestamp: now,
          };
          this.reps.push(rep);
          if (rep.valid) {
            this.counts[exercise]++;
            this.score += scoreRep(rep);
            this.event = "rep";
            if (this.counts[exercise] >= TARGETS[exercise]) {
              const next = ORDER.find(
                (item) => this.counts[item] < TARGETS[item],
              );
              if (next) {
                this.enter("transition", now);
                this.event = "round";
              } else {
                this.workoutEnded = now;
                this.enter("complete", now);
                this.event = "complete";
              }
            }
          } else if (rep.errors[0]) {
            this.primaryError = rep.errors[0];
          }
        }
      }
    }
    return this.snapshot(now);
  }

  snapshot(now = performance.now()): WorkoutSnapshot {
    const exercise = this.exercise();
    const nextExercise =
      this.stage === "transition"
        ? (ORDER.find((item) => this.counts[item] < TARGETS[item]) ?? null)
        : null;
    const elapsedMs = this.workoutStarted
      ? (this.workoutEnded || now) - this.workoutStarted
      : 0;
    const secondsRemaining =
      this.stage === "countdown"
        ? Math.max(1, Math.ceil((3000 - (now - this.stageSince)) / 1000))
        : this.stage === "transition"
          ? Math.max(1, Math.ceil((2400 - (now - this.stageSince)) / 1000))
          : 0;
    return {
      stage: this.stage,
      exercise,
      nextExercise,
      phase: this.phase,
      cue: this.cue,
      primaryError: this.primaryError,
      counts: { ...this.counts },
      targets: { ...TARGETS },
      reps: [...this.reps],
      score: this.score,
      formScore: formScore(this.reps),
      elapsedMs,
      secondsRemaining,
      setupMessage: this.setupMessage,
      setupProgress: this.setupProgress,
      gestureProgress: this.gestureProgress,
      tracking: this.tracking,
      debug: { ...this.debug },
      event: this.event,
    };
  }
}
