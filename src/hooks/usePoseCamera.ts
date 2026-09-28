"use client";

import { useEffect, useRef, useState } from "react";
import { VISION } from "@/config/thresholds";
import { drawPose } from "@/lib/pose/overlay";
import type { FormError, Landmarks } from "@/lib/pose/types";

export type CameraStatus =
  "idle" | "permission" | "loading" | "ready" | "error";
export interface FrameInfo {
  fps: number;
  inferenceMs: number;
}

function cameraMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Camera access is blocked. Allow camera access in your browser and try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera was found. Connect a webcam and try again.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "Your camera is busy in another app. Close that app and try again.";
  return "The camera could not start. Check your browser permissions and try again.";
}

export function usePoseCamera(
  enabled: boolean,
  onFrame: (
    landmarks: Landmarks | null,
    world: Landmarks | null,
    now: number,
    aspect: number,
    info: FrameInfo,
  ) => FormError | null,
  onReady: () => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let landmarker: import("@mediapipe/tasks-vision").PoseLandmarker | null =
      null;
    let lastInference = 0;
    let lastVideoTime = -1;
    let lastFrame = 0;
    const videoElement = videoRef.current;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "This browser does not support webcam access. Use a recent browser on HTTPS or localhost.",
        );
        setStatus("error");
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (firstError) {
          if (
            firstError instanceof DOMException &&
            firstError.name === "OverconstrainedError"
          )
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true,
            });
          else throw firstError;
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) throw new Error("Video element missing");
        video.srcObject = stream;
        await video.play();
      } catch (cause) {
        if (!cancelled) {
          setError(cameraMessage(cause));
          setStatus("error");
        }
        return;
      }

      setStatus("loading");
      try {
        const { FilesetResolver, PoseLandmarker } =
          await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        }).catch(async () =>
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.55,
            minPosePresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          }),
        );
        if (cancelled) {
          landmarker.close();
          return;
        }
        setStatus("ready");
        onReady();

        const loop = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const now = performance.now();
          if (
            video &&
            canvas &&
            landmarker &&
            video.readyState >= 2 &&
            now - lastInference >= VISION.inferenceIntervalMs &&
            video.currentTime !== lastVideoTime
          ) {
            const begin = performance.now();
            try {
              const result = landmarker.detectForVideo(video, now);
              const landmarks = result.landmarks[0] ?? null;
              const world = result.worldLandmarks[0] ?? null;
              const info = {
                fps: lastFrame ? Math.round(1000 / (now - lastFrame)) : 0,
                inferenceMs: Math.round(performance.now() - begin),
              };
              const error = onFrame(
                landmarks,
                world,
                now,
                video.videoWidth / video.videoHeight,
                info,
              );
              drawPose(canvas, video, landmarks, error);
              lastFrame = now;
              lastVideoTime = video.currentTime;
              lastInference = now;
            } catch {
              // A single bad frame should not end the workout.
            }
          }
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) {
          setError(
            "MotionCoach AI could not load. Check your connection and try again.",
          );
          setStatus("error");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
      landmarker?.close();
    };
  }, [enabled, retryKey, onFrame, onReady]);

  return {
    videoRef,
    canvasRef,
    status:
      enabled && status === "idle" ? ("permission" as CameraStatus) : status,
    error,
    retry: () => {
      setStatus("permission");
      setError("");
      setRetryKey((key) => key + 1);
    },
  };
}
