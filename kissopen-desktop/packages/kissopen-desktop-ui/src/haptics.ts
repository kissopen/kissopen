/**
 * Haptic feedback for direct-manipulation gestures, on the platforms that have
 * it. Every signal is best-effort and silent: where the platform exposes no
 * haptics — which today includes macOS, since neither WebKit nor Electron
 * surfaces `NSHapticFeedbackManager` — these calls do nothing at all, so a
 * gesture can ask for feedback unconditionally instead of branching on the host.
 *
 * The signals name what the gesture means rather than what the hardware does, so
 * a platform can map them to whatever it actually has:
 *
 * - `selection` — the gesture crossed a detent and now targets something new.
 *   Fired repeatedly during a drag, so it must stay the lightest signal.
 * - `impact` — the gesture committed: something was dropped and moved.
 *
 * Requesting a vibration outside a user gesture is refused by browsers, which is
 * fine: every caller here is inside a pointer handler.
 */
export type HapticSignal = "selection" | "impact";

/** Milliseconds of vibration per signal, kept short enough to read as a tick rather than a buzz. */
const DURATIONS: Record<HapticSignal, number> = {
    selection: 4,
    impact: 12,
};

export function haptic(signal: HapticSignal): void {
    if (typeof navigator === "undefined") return;
    const vibrate = (navigator as Navigator & { vibrate?: (pattern: number) => boolean }).vibrate;
    if (typeof vibrate !== "function") return;
    try {
        vibrate.call(navigator, DURATIONS[signal]);
    } catch {
        // A host that has the method but refuses the call (no motor, no user
        // activation, a policy) is exactly the "not supported" case: stay quiet.
    }
}
