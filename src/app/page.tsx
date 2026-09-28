"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Camera,
  Check,
  CircleAlert,
  Crosshair,
  Footprints,
  Hand,
  LockKeyhole,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trophy,
  Volume2,
  Zap,
} from "lucide-react";
import { DEBUG } from "@/config/thresholds";
import {
  usePoseCamera,
  type FrameInfo,
  type CameraStatus,
} from "@/hooks/usePoseCamera";
import { closeAudio, playSound } from "@/lib/audio";
import type {
  Exercise,
  FormError,
  Landmarks,
  WorkoutSnapshot,
} from "@/lib/pose/types";
import {
  errorsCorrected,
  exerciseForm,
  scoreBreakdown,
} from "@/lib/workout/scoring";
import {
  readLeaderboard,
  saveLeaderboard,
  type LeaderboardEntry,
} from "@/lib/workout/storage";
import { WorkoutMachine } from "@/lib/workout/workoutMachine";

const LABELS: Record<Exercise, string> = {
  squat: "Squats",
  lunge: "Lunges",
  jumpingJack: "Jumping jacks",
};
const ORDER: Exercise[] = ["squat", "lunge", "jumpingJack"];

function time(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ActivityMark />
      </span>
      <span>
        MOTION<span className="brand-light">COACH</span>
      </span>
      <span className="brand-dot">.</span>
    </div>
  );
}

function ActivityMark() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M2 15h6l3-7 5 14 3-7h7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroFigure() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-grid" />
      <div className="hero-cross hero-cross-a">+</div>
      <div className="hero-cross hero-cross-b">+</div>
      <div className="hero-scan">
        <span>LIVE TRACKING</span>
        <span>● REC</span>
      </div>
      <svg className="hero-body" viewBox="0 0 480 520" fill="none">
        <circle cx="240" cy="82" r="28" stroke="#D8FC75" strokeWidth="3" />
        <path
          d="M240 110v144m0-122-84 68-47 82m131-150 84 68 47 82M240 254l-77 91-32 119m109-210 77 91 32 119"
          stroke="#D8FC75"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M156 200 324 200M163 345l154 0"
          stroke="#D8FC75"
          strokeWidth="2"
          opacity=".35"
        />
        {[
          [240, 110],
          [240, 254],
          [156, 200],
          [109, 282],
          [324, 200],
          [371, 282],
          [163, 345],
          [131, 464],
          [317, 345],
          [349, 464],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="10" fill="#D8FC75" fillOpacity=".12" />
            <circle cx={x} cy={y} r="4.5" fill="#D8FC75" />
          </g>
        ))}
      </svg>
      <div className="hero-target target-one">
        POSE ACQUIRED <Check size={13} />
      </div>
      <div className="hero-target target-two">
        FORM SCORE <strong>94%</strong>
      </div>
      <div className="hero-bottom">
        <span>33 LANDMARKS</span>
        <span>ON-DEVICE ANALYSIS</span>
      </div>
    </div>
  );
}

function CameraPanel({
  videoRef,
  canvasRef,
  status,
  stage,
  error,
  snapshot,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  stage: WorkoutSnapshot["stage"];
  error: string;
  snapshot: WorkoutSnapshot;
}) {
  const isWorkout = !!snapshot.exercise;
  return (
    <div className={`camera-panel ${stage === "results" ? "camera-mini" : ""}`}>
      <div className="camera-media">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          aria-label="Live camera preview"
        />
        <canvas ref={canvasRef} className="camera-canvas" aria-hidden="true" />
      </div>
      <div className="camera-vignette" />
      <div className="frame-corner tl" />
      <div className="frame-corner tr" />
      <div className="frame-corner bl" />
      <div className="frame-corner br" />
      <div className="camera-topline">
        <span className="live-pill">
          <span className="live-dot" /> LIVE CAMERA
        </span>
        <span className="camera-local">
          <LockKeyhole size={13} /> LOCAL PROCESSING
        </span>
      </div>
      {status !== "ready" && (
        <div className="camera-loading">
          <div className="loading-orbit">
            <ScanLine size={32} />
          </div>
          <strong>
            {status === "permission"
              ? "Requesting camera access…"
              : status === "loading"
                ? "Loading MotionCoach AI…"
                : status === "error"
                  ? "Camera unavailable"
                  : "Starting camera…"}
          </strong>
          <span>
            {status === "error"
              ? error
              : "Preparing your personal movement coach"}
          </span>
        </div>
      )}
      {status === "ready" && stage !== "results" && (
        <>
          <div
            className={`tracking-pill ${snapshot.tracking ? "is-tracking" : ""}`}
          >
            <span className="tracking-indicator" />
            {snapshot.tracking ? "BODY IN FRAME" : "POSITION FULL BODY"}
          </div>
          {isWorkout && (
            <div className="camera-rep">
              <span>REP COUNT</span>
              <strong>{snapshot.counts[snapshot.exercise!]}</strong>
              <span>/ {snapshot.targets[snapshot.exercise!]}</span>
            </div>
          )}
          <div className="camera-bottomline">
            <span>CAM 01 / FRONT</span>
            <span>
              {isWorkout
                ? snapshot.phase.toUpperCase()
                : "POSE LANDMARKER ACTIVE"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [machine] = useState(() => new WorkoutMachine());
  const [view, setView] = useState<WorkoutSnapshot>(() => machine.snapshot(0));
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    typeof window === "undefined" ? [] : readLeaderboard(),
  );
  const [newRecord, setNewRecord] = useState(false);
  const lastUi = useRef(0);
  const lastStage = useRef(view.stage);
  const lastCountdown = useRef(0);
  const saved = useRef(false);

  const onFrame = useCallback(
    (
      landmarks: Landmarks | null,
      world: Landmarks | null,
      now: number,
      aspect: number,
      info: FrameInfo,
    ): FormError | null => {
      const snapshot = machine.update(landmarks, now, aspect, world);
      snapshot.debug = {
        ...snapshot.debug,
        fps: info.fps,
        inferenceMs: info.inferenceMs,
      };
      if (snapshot.event) playSound(snapshot.event);
      if (
        snapshot.stage === "countdown" &&
        snapshot.secondsRemaining !== lastCountdown.current
      ) {
        playSound("tick");
        lastCountdown.current = snapshot.secondsRemaining;
      }
      if (snapshot.stage !== "countdown") lastCountdown.current = 0;
      if (lastStage.current === "results" && snapshot.stage !== "results")
        saved.current = false;
      if (
        now - lastUi.current > 110 ||
        snapshot.stage !== lastStage.current ||
        snapshot.event
      ) {
        setView(snapshot);
        lastUi.current = now;
        lastStage.current = snapshot.stage;
      }
      return snapshot.primaryError;
    },
    [machine],
  );

  const onReady = useCallback(() => {
    machine.cameraReady();
    setView(machine.snapshot());
  }, [machine]);
  const camera = usePoseCamera(cameraEnabled, onFrame, onReady);

  useEffect(() => () => closeAudio(), []);
  useEffect(() => {
    if (view.stage === "results" && !saved.current) {
      saved.current = true;
      const existing = readLeaderboard();
      setNewRecord(existing.length === 0 || view.score > existing[0].score);
      setLeaderboard(
        saveLeaderboard({
          score: view.score,
          formScore: view.formScore,
          durationMs: view.elapsedMs,
          date: new Date().toISOString(),
        }),
      );
    }
  }, [view.stage, view.score, view.formScore, view.elapsedMs]);

  const beginCamera = () => {
    machine.requestCamera();
    setView(machine.snapshot());
    setCameraEnabled(true);
    playSound("tick");
  };
  const beginWorkout = () => {
    machine.start();
    setView(machine.snapshot());
    playSound("tick");
  };
  const restart = () => {
    saved.current = false;
    machine.restart();
    setView(machine.snapshot());
  };

  const stage = view.stage;
  const isLanding = stage === "landing";
  const isResults = stage === "results";
  const isSetup =
    stage === "camera_permission" ||
    stage === "camera_setup" ||
    stage === "ready";
  const isActive = !!view.exercise;
  const roundIndex = view.exercise
    ? ORDER.indexOf(view.exercise) + 1
    : stage === "transition"
      ? ORDER.findIndex((item) => view.counts[item] < view.targets[item]) + 1
      : 1;
  const totalTargets = ORDER.reduce((sum, item) => sum + view.targets[item], 0);
  const totalCount = ORDER.reduce((sum, item) => sum + view.counts[item], 0);
  const progress = totalTargets ? totalCount / totalTargets : 0;
  const scores = scoreBreakdown(view.reps);
  const errors = view.reps.flatMap((rep) => rep.errors);
  const errorCounts = new Map<string, number>();
  errors.forEach((error) =>
    errorCounts.set(error.message, (errorCounts.get(error.message) ?? 0) + 1),
  );
  const topError =
    [...errorCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Keep moving with the same control.";
  const best = [...ORDER].sort(
    (a, b) => exerciseForm(view.reps, b) - exerciseForm(view.reps, a),
  )[0];

  return (
    <main className="app-shell">
      <header className="site-header">
        <Logo />
        <nav>
          <span className="nav-link">THE CHALLENGE</span>
          <span className="nav-link">HOW IT WORKS</span>
          <span className="header-badge">
            <span /> CAMERA = CONTROLLER
          </span>
        </nav>
      </header>

      {isLanding && (
        <>
          <section className="landing-hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" /> THE FUTURE OF FITNESS IS IN
                MOTION
              </div>
              <h1>
                YOUR BODY.
                <br />
                <em>YOUR CONTROLLER.</em>
              </h1>
              <p className="hero-lead">
                Your camera becomes your personal movement coach.
              </p>
              <p className="hero-description">
                Three rounds. Real-time form coaching. Every rep earned through
                movement — no equipment, no guesswork.
              </p>
              <button className="primary-button" onClick={beginCamera}>
                <span>START CHALLENGE</span>
                <ArrowRight size={20} />
              </button>
              <div className="hero-meta">
                <span>
                  <ShieldCheck size={16} /> PRIVATE BY DESIGN
                </span>
                <i />
                <span>
                  <Camera size={16} /> WEBCAM REQUIRED
                </span>
              </div>
            </div>
            <HeroFigure />
          </section>
          <section className="challenge-strip">
            <div>
              <span className="strip-number">03</span>
              <span>ROUNDS</span>
            </div>
            <div>
              <span className="strip-number">
                {totalTargets.toString().padStart(2, "0")}
              </span>
              <span>REPS TO COMPLETE</span>
            </div>
            <div>
              <span className="strip-number">~02</span>
              <span>MINUTES</span>
            </div>
            <div className="strip-aside">
              <span>
                NO JOYSTICK.
                <br />
                JUST YOU.
              </span>
              <ArrowDownRight size={27} />
            </div>
          </section>
          <section className="landing-bottom">
            <div className="section-heading">
              <span className="eyebrow">01 / WHY MOTIONCOACH</span>
              <h2>
                MOVE WITH <em>INTENTION.</em>
              </h2>
            </div>
            <div className="feature-grid">
              <div className="feature-card">
                <Crosshair />
                <span>01 / REAL-TIME TRACKING</span>
                <p>
                  Camera-based pose detection counts each complete movement.
                </p>
              </div>
              <div className="feature-card">
                <Sparkles />
                <span>02 / FORM COACH</span>
                <p>
                  Specific, immediate corrections help you improve as you go.
                </p>
              </div>
              <div className="feature-card">
                <Hand />
                <span>03 / HANDS-FREE</span>
                <p>
                  Raise both hands to start. Your body controls the challenge.
                </p>
              </div>
              <div className="feature-card">
                <LockKeyhole />
                <span>04 / PRIVATE BY DESIGN</span>
                <p>Video processing happens locally in your browser.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {!isLanding && (
        <div className={`experience ${isResults ? "results-experience" : ""}`}>
          {!isResults && (
            <div className="experience-heading">
              <span className="eyebrow">
                <span className="eyebrow-line" /> THE THREE-ROUND CHALLENGE
              </span>
              <div className="experience-title">
                <h1>
                  {isSetup
                    ? "GET IN POSITION."
                    : isActive
                      ? LABELS[view.exercise!].toUpperCase() + "."
                      : stage === "countdown"
                        ? "GET READY."
                        : stage === "transition"
                          ? "ROUND COMPLETE."
                          : "CHALLENGE COMPLETE."}
                </h1>
                <span>
                  {isSetup
                    ? "01 / SETUP"
                    : isActive
                      ? `0${roundIndex} / 03`
                      : "MOTIONCOACH"}
                </span>
              </div>
            </div>
          )}
          <div className={isResults ? "results-layout" : "workout-layout"}>
            <CameraPanel {...camera} stage={stage} snapshot={view} />
            {!isResults && (
              <aside className="coach-panel">
                {isSetup ? (
                  <>
                    <div className="panel-overline">
                      <ScanLine size={16} /> CAMERA SETUP
                    </div>
                    <div className="setup-main">
                      <div className="setup-icon">
                        <Crosshair size={42} />
                      </div>
                      <h2>
                        {camera.status === "ready"
                          ? stage === "ready"
                            ? "YOU'RE IN FRAME."
                            : "FIND YOUR FRAME."
                          : camera.status === "error"
                            ? "CAMERA CHECK."
                            : "CONNECTING..."}
                      </h2>
                      <p>
                        {camera.status === "ready"
                          ? view.setupMessage
                          : camera.status === "error"
                            ? camera.error
                            : camera.status === "loading"
                              ? "Loading MotionCoach AI…"
                              : "Allow camera access to begin."}
                      </p>
                    </div>
                    {camera.status === "ready" && (
                      <div className="setup-checklist">
                        <div>
                          <span>
                            <Check size={14} />
                          </span>{" "}
                          Head & shoulders visible
                        </div>
                        <div>
                          <span>
                            <Check size={14} />
                          </span>{" "}
                          Hips and knees visible
                        </div>
                        <div>
                          <span>
                            <Check size={14} />
                          </span>{" "}
                          Ankles inside frame
                        </div>
                      </div>
                    )}
                    {stage === "ready" && (
                      <div className="gesture-card">
                        <div>
                          <Hand size={23} />
                          <div>
                            <strong>HANDS-FREE START</strong>
                            <span>
                              Hold both hands overhead for 1.25 seconds
                            </span>
                          </div>
                        </div>
                        <div className="gesture-track">
                          <span
                            style={{ width: `${view.gestureProgress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {stage === "camera_setup" && camera.status === "ready" && (
                      <div className="setup-progress">
                        <span>STABILITY CHECK</span>
                        <strong>{Math.round(view.setupProgress * 100)}%</strong>
                        <div className="progress-track">
                          <span
                            style={{ width: `${view.setupProgress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {stage === "ready" && (
                      <button
                        className="secondary-button"
                        onClick={beginWorkout}
                      >
                        START WORKOUT <ArrowRight size={18} />
                      </button>
                    )}
                    {camera.status === "error" && (
                      <button
                        className="secondary-button"
                        onClick={camera.retry}
                      >
                        TRY AGAIN <RotateCcw size={18} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="panel-overline">
                      <Zap size={16} />{" "}
                      {isActive
                        ? `ROUND 0${roundIndex} / 03`
                        : stage === "transition"
                          ? "UP NEXT"
                          : "THE FINISH LINE"}
                    </div>
                    <div className="round-head">
                      <span>
                        {isActive
                          ? LABELS[view.exercise!].toUpperCase()
                          : stage === "transition"
                            ? LABELS[view.nextExercise!].toUpperCase()
                            : stage === "countdown"
                              ? "STARTING IN"
                              : "WELL DONE"}
                      </span>
                      <div className="round-number">
                        {isActive ? (
                          <>
                            {view.counts[view.exercise!]}
                            <small> / {view.targets[view.exercise!]}</small>
                          </>
                        ) : stage === "countdown" || stage === "transition" ? (
                          view.secondsRemaining
                        ) : (
                          <Trophy size={50} />
                        )}
                      </div>
                    </div>
                    <div className="feedback-box">
                      <span className="feedback-label">
                        {view.primaryError ? (
                          <>
                            <CircleAlert size={15} /> FORM CHECK
                          </>
                        ) : (
                          <>
                            <Check size={15} />{" "}
                            {isActive ? "LIVE COACHING" : "MOTIONCOACH"}
                          </>
                        )}
                      </span>
                      <p>
                        {view.primaryError?.message ??
                          (isActive
                            ? view.cue
                            : stage === "countdown"
                              ? "Your first round starts now."
                              : stage === "transition"
                                ? "Take a breath. The next round starts automatically."
                                : "Your results are ready.")}
                      </p>
                    </div>
                    <div className="workout-stats">
                      <div>
                        <span>FORM SCORE</span>
                        <strong>
                          {view.formScore}
                          <small>%</small>
                        </strong>
                      </div>
                      <div>
                        <span>TOTAL SCORE</span>
                        <strong>{view.score.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span>TIME</span>
                        <strong>{time(view.elapsedMs)}</strong>
                      </div>
                    </div>
                    <div className="overall-progress">
                      <div>
                        <span>CHALLENGE PROGRESS</span>
                        <strong>
                          {totalCount} / {totalTargets}
                        </strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${progress * 100}%` }} />
                      </div>
                    </div>
                    <div className="round-steps">
                      {ORDER.map((item, index) => (
                        <div
                          key={item}
                          className={
                            view.counts[item] >= view.targets[item]
                              ? "step-done"
                              : view.exercise === item
                                ? "step-active"
                                : ""
                          }
                        >
                          <span>0{index + 1}</span>
                          <span>{LABELS[item].toUpperCase()}</span>
                          <span>
                            {view.counts[item] >= view.targets[item] ? (
                              <Check size={15} />
                            ) : (
                              `${view.counts[item]}/${view.targets[item]}`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </aside>
            )}
            {isResults && (
              <div className="results-content">
                <div className="results-header">
                  <div className="eyebrow">
                    <span className="eyebrow-line" /> CHALLENGE COMPLETE
                  </div>
                  <h1>
                    YOU SHOWED UP.
                    <br />
                    <em>YOU MOVED.</em>
                  </h1>
                  <p>
                    Every counted rep was earned. Here’s your movement report.
                  </p>
                </div>
                <div className="results-main">
                  <div className="score-hero">
                    <span>TOTAL SCORE</span>
                    <strong>{view.score.toLocaleString()}</strong>
                    <div>
                      {newRecord ? (
                        <>
                          <Trophy size={17} /> NEW PERSONAL BEST
                        </>
                      ) : (
                        <>
                          <Check size={17} /> CHALLENGE COMPLETE
                        </>
                      )}
                    </div>
                  </div>
                  <div className="result-metrics">
                    <div>
                      <span>FORM SCORE</span>
                      <strong>{view.formScore}%</strong>
                    </div>
                    <div>
                      <span>TIME</span>
                      <strong>{time(view.elapsedMs)}</strong>
                    </div>
                    <div>
                      <span>VALID REPS</span>
                      <strong>
                        {totalCount}
                        <small>/{totalTargets}</small>
                      </strong>
                    </div>
                    <div>
                      <span>ERRORS CORRECTED</span>
                      <strong>{errorsCorrected(view.reps)}</strong>
                    </div>
                  </div>
                </div>
                <div className="results-rounds">
                  {ORDER.map((item, index) => (
                    <div key={item}>
                      <span className="result-round-num">0{index + 1}</span>
                      <Footprints size={19} />
                      <div>
                        <strong>{LABELS[item]}</strong>
                        <span>
                          {view.counts[item]} / {view.targets[item]} reps
                        </span>
                      </div>
                      <strong>
                        {exerciseForm(view.reps, item)}% <small>FORM</small>
                      </strong>
                      <span className="round-points">+{scores[item]}</span>
                    </div>
                  ))}
                </div>
                <div className="results-insights">
                  <div>
                    <span>
                      <Sparkles size={16} /> STRONGEST MOVEMENT
                    </span>
                    <strong>{LABELS[best]}</strong>
                  </div>
                  <div>
                    <span>
                      <Crosshair size={16} /> NEXT FOCUS
                    </span>
                    <strong>{topError}</strong>
                  </div>
                </div>
                <div className="results-actions">
                  <button className="primary-button" onClick={restart}>
                    TRY AGAIN <RotateCcw size={18} />
                  </button>
                  <span>
                    <Hand size={18} /> Or raise both hands to restart
                  </span>
                </div>
                <div className="leaderboard">
                  <div>
                    <span>LOCAL LEADERBOARD</span>
                    <Trophy size={16} />
                  </div>
                  {leaderboard.map((entry, index) => (
                    <div key={`${entry.date}-${index}`}>
                      <span>0{index + 1}</span>
                      <strong>{entry.score.toLocaleString()}</strong>
                      <span>{entry.formScore}% FORM</span>
                      <span>{time(entry.durationMs)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <footer className="site-footer">
        <span>© MOTIONCOACH</span>
        <span>
          <Volume2 size={14} /> AUDIO ON
        </span>
        <span>
          <ShieldCheck size={14} /> VIDEO PROCESSING HAPPENS LOCALLY IN YOUR
          BROWSER
        </span>
      </footer>
      {DEBUG && !isLanding && (
        <div className="debug-panel">
          <strong>POSE DEBUG</strong>
          {Object.entries(view.debug).map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <b>{value}</b>
            </div>
          ))}
          <div>
            <span>stage</span>
            <b>{view.stage}</b>
          </div>
          <div>
            <span>error</span>
            <b>{view.primaryError?.id ?? "none"}</b>
          </div>
        </div>
      )}
    </main>
  );
}
