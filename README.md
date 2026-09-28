# MotionCoach

**Your camera becomes your personal movement coach.** MotionCoach is a browser-only, three-round fitness challenge controlled by body movement. MediaPipe Pose Landmarker runs on the client, while the app owns the exercise rules, rep state machines, form feedback, and scoring.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow camera access, stand far enough back to show your head through your ankles, and hold both hands above your shoulders to begin. A button is available before the workout. Once a round begins, the challenge advances automatically. Hold both hands up on the results screen to restart.

The app requires a recent browser, a webcam, and HTTPS or localhost. Camera frames and pose landmarks remain in the browser. Only score, form score, duration, and date are saved in `localStorage`.

## Challenge

| Round         | Target | Valid cycle                                           |
| ------------- | -----: | ----------------------------------------------------- |
| Squats        |     10 | Stand → lower to depth → stand                        |
| Lunges        |     10 | Stand → one knee bends to depth → stand               |
| Jumping jacks |     15 | Arms down/feet together → arms high/feet wide → close |

Each valid rep earns 100 points; reps with at least 90% quality receive 25 bonus points. An incomplete attempt earns no points. Form Score is the mean quality of valid reps with a small deduction for incomplete attempts. Results come from detected movement, never randomized values.

For a short test session, set `NEXT_PUBLIC_SHORT_CHALLENGE=true` before building to use targets of 3/3/5. Set `NEXT_PUBLIC_DEBUG_POSE=true` to show FPS, inference time, landmark confidence, joint angles, detector phase, and current error. Adjust thresholds in [`src/config/thresholds.ts`](src/config/thresholds.ts).

## Architecture

- `src/hooks/usePoseCamera.ts`: webcam lifecycle, MediaPipe inference loop, GPU/CPU fallback, cleanup.
- `src/lib/pose`: confidence gating, EMA smoothing, 2D/3D geometry, mirrored canvas overlay.
- `src/lib/exercises`: separate squat, lunge, and jumping-jack finite-state detectors.
- `src/lib/feedback`: persisted, prioritized, cooled-down form corrections.
- `src/lib/workout`: state machine, deterministic scoring, and local leaderboard.

The pose model is stored in `public/mediapipe/pose_landmarker_lite.task`. The `postinstall` script copies the matching package's WASM runtime to `public/mediapipe/wasm`, so both are served from the deployed app. The model is Google's [MediaPipe Pose Landmarker Lite](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) bundle.

## Verify and deploy

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Deploy the repository to Vercel as a standard Next.js project. The normal `npm install` step prepares the local WASM assets. HTTPS is required for webcam access on a deployed domain.

Pose-based form feedback is coaching guidance, not a medical assessment. Lighting, camera angle, body framing, and occlusion affect tracking. The app stops counting when required landmarks lose confidence and asks the user to reposition.
