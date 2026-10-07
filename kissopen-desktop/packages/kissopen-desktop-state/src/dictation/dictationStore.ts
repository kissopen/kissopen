import { t } from "../i18n/locale.js";

/*
Dictation: speaking into a composer instead of typing.

The microphone is opened, the clip is recorded until the reader stops it or a
minute is up, and the recording goes to the account's transcription service;
the words come back and are handed to whatever composer asked. One store
serves every composer in the window, because there is one microphone, and the
composer that started a recording is the one that receives its words.

The store owns the browser's recorder, which is why it lives here and not in
a component: a recording outlives a re-render, and a component that unmounted
mid-sentence would have lost it.
*/

export type DictationStatus = "idle" | "recording" | "transcribing";

export type DictationSnapshot = {
    readonly status: DictationStatus;
    /** How long the current recording has run, ticking while it does. */
    readonly elapsedMs: number;
    /** Why the last attempt gave no words, in the reader's words; empty when it did. */
    readonly error: string;
    /** How loud the room has been, 0–1, newest last: the wave a composer draws while recording. */
    readonly levels: readonly number[];
};

/** How many readings the wave keeps. */
export const DICTATION_WAVE_BARS = 48;

export interface DictationStore {
    get(): DictationSnapshot;
    subscribe(listener: () => void): () => void;
    /**
     * Starts recording for one composer: `sink` receives the words when they
     * come back. A recording already running is left alone.
     */
    recordingStart(sink: (text: string) => void): void;
    /** Stops the recording and sends it to be transcribed. */
    recordingStop(): void;
    /** The mic button: start when idle, stop when recording, nothing while transcribing. */
    recordingToggle(sink: (text: string) => void): void;
}

/** A recording stops itself here; the server takes a clip of about a minute. */
const MAX_MS = 60_000;
const TICK_MS = 80;

export function dictationStoreCreate(deps: {
    /** The account's transcription: audio in, words out. */
    transcribe(mime: string, base64: string, durationMs: number): Promise<string>;
}): DictationStore {
    let state: DictationSnapshot = { status: "idle", elapsedMs: 0, error: "", levels: [] };
    const listeners = new Set<() => void>();
    const set = (patch: Partial<DictationSnapshot>) => {
        state = { ...state, ...patch };
        for (const listener of listeners) listener();
    };
    let recorder: MediaRecorder | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;

    const recordingStart = (sink: (text: string) => void) => {
        if (state.status !== "idle") return;
        set({ error: "" });
        void (async () => {
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch {
                set({ error: t("用不了麦克风，请检查系统的麦克风权限") });
                return;
            }
            // AAC in an MP4 first: it is what the phone records, and the speech
            // service answers it in seconds where Opus in WebM takes it a
            // variable and sometimes long while.
            const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((candidate) =>
                MediaRecorder.isTypeSupported(candidate),
            );
            const current = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
            const chunks: Blob[] = [];
            const started = Date.now();
            // The meter: the same stream through an analyser, read on each tick.
            const audio = new AudioContext();
            const analyser = audio.createAnalyser();
            analyser.fftSize = 1024;
            audio.createMediaStreamSource(stream).connect(analyser);
            const samples = new Uint8Array(analyser.fftSize);
            const level = () => {
                analyser.getByteTimeDomainData(samples);
                let sum = 0;
                for (const sample of samples) {
                    const centred = (sample - 128) / 128;
                    sum += centred * centred;
                }
                // RMS of speech sits around 0.05–0.3; stretched so a voice fills the bar.
                return Math.min(1, Math.sqrt(sum / samples.length) * 4);
            };
            current.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
            };
            current.onstop = () => {
                for (const track of stream.getTracks()) track.stop();
                void audio.close();
                if (ticker) clearInterval(ticker);
                ticker = undefined;
                recorder = undefined;
                const durationMs = Date.now() - started;
                const blob = new Blob(chunks, { type: current.mimeType || "audio/webm" });
                if (blob.size === 0 || durationMs < 300) {
                    set({ status: "idle", elapsedMs: 0, levels: [] });
                    return;
                }
                set({ status: "transcribing", levels: [] });
                void (async () => {
                    try {
                        const text = await deps.transcribe(
                            blob.type.split(";")[0] ?? "audio/webm",
                            await base64Of(blob),
                            durationMs,
                        );
                        set({ status: "idle", elapsedMs: 0 });
                        if (text.trim()) sink(text.trim());
                        else set({ error: t("没有听到说话") });
                    } catch (error) {
                        set({
                            status: "idle",
                            elapsedMs: 0,
                            error: error instanceof Error ? error.message : t("语音没有转成文字"),
                        });
                    }
                })();
            };
            recorder = current;
            current.start(1000);
            set({ status: "recording", elapsedMs: 0, levels: [] });
            ticker = setInterval(() => {
                const elapsedMs = Date.now() - started;
                set({
                    elapsedMs,
                    levels: [...state.levels.slice(-(DICTATION_WAVE_BARS - 1)), level()],
                });
                if (elapsedMs >= MAX_MS) recordingStop();
            }, TICK_MS);
        })();
    };
    const recordingStop = () => {
        if (recorder && recorder.state !== "inactive") recorder.stop();
    };

    return {
        get: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        recordingStart,
        recordingStop,
        recordingToggle: (sink) => {
            if (state.status === "idle") recordingStart(sink);
            else if (state.status === "recording") recordingStop();
        },
    };
}

/** The clip as base64, the way the transcription request carries it. */
function base64Of(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.onload = () => {
            const url = String(reader.result);
            resolve(url.slice(url.indexOf(",") + 1));
        };
        reader.readAsDataURL(blob);
    });
}
