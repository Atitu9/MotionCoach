import type { WorkoutSnapshot } from "@/lib/pose/types";

let context: AudioContext | null = null;

export function playSound(
  kind: NonNullable<WorkoutSnapshot["event"]> | "tick",
): void {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes =
      kind === "rep"
        ? [660]
        : kind === "round"
          ? [523, 784]
          : kind === "complete"
            ? [523, 659, 784, 1046]
            : kind === "warning"
              ? [290]
              : [440];
    notes.forEach((frequency, index) => {
      if (!context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = now + index * 0.12;
      oscillator.type = kind === "warning" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(
        kind === "warning" ? 0.025 : 0.055,
        at + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.13);
    });
  } catch {
    /* Audio is optional. */
  }
}

export function closeAudio(): void {
  try {
    void context?.close();
  } catch {
    /* Browser may already have closed it. */
  }
  context = null;
}
