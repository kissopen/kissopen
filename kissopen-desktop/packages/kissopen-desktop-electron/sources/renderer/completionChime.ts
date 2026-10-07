/**
 * Plays a short two-note completion chime. The oscillator keeps the sound local
 * and avoids shipping or decoding an asset for a sub-second desktop cue.
 */
export function completionChimePlay(): void {
    try {
        const AudioContextConstructor = window.AudioContext;
        const context = new AudioContextConstructor();
        const gain = context.createGain();
        gain.connect(context.destination);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);

        for (const [frequency, delay] of [
            [659.25, 0],
            [880, 0.11],
        ] as const) {
            const oscillator = context.createOscillator();
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            oscillator.connect(gain);
            oscillator.start(context.currentTime + delay);
            oscillator.stop(context.currentTime + delay + 0.28);
        }
        window.setTimeout(() => void context.close(), 500);
    } catch {
        // A missing or policy-blocked audio device must not interrupt reconciliation.
    }
}
