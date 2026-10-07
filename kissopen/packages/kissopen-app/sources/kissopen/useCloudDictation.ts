import * as React from 'react';
import { RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { Modal } from '@/modal';
import { requestMicrophonePermission, showMicrophonePermissionDeniedAlert } from '@/utils/microphonePermissions';
import { client } from './api/client';
import { t } from '@/text';
import { DICTATION_WAVE_BARS } from '@/components/DictationWave';

/**
 * Speech recognition resamples to 16 kHz mono regardless, so recording above
 * that only inflates the upload. HIGH_QUALITY's 44.1 kHz stereo 128 kbps is a
 * minute at ~1 MB, which would not survive the server's body limit once base64
 * inflates it; this is the same minute at ~240 KB with no loss of accuracy.
 *
 * LOW_QUALITY would also be small but is avoided on purpose: on Android it
 * encodes AMR narrowband, which does cost recognition accuracy.
 */
const DICTATION_RECORDING = {
    ...RecordingPresets.HIGH_QUALITY,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    // The level, read while recording, is what the wave in the composer draws.
    isMeteringEnabled: true,
};

/** Keeps the upload inside the server's 700 KB ceiling, and stops a forgotten mic. */
const MAX_DURATION_MS = 60_000;

/** The container the recorder produced, as the server's allowlist spells it. */
const MIME_BY_EXTENSION: Record<string, string> = {
    m4a: 'audio/m4a',
    mp4: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    '3gp': 'audio/3gpp',
};

export type DictationState = 'idle' | 'recording' | 'transcribing';

/**
 * Tap-to-toggle dictation for the cloud chat: tap to record, tap again to stop
 * and transcribe, and the transcript is handed to `onText` to drop into the
 * composer. Errors surface here rather than through a return value, because
 * every one of them is something the user has to see and retry.
 *
 * This is deliberately not the bot's realtime voice: that needs a KISSOPEN session
 * id and credentials, which the consumer cloud API is kept clear of. Here the
 * clip round-trips through the pool's transcription endpoint and comes back as
 * text the user can edit before sending.
 */
export function useCloudDictation(onText: (text: string) => void) {
    const recorder = useAudioRecorder(DICTATION_RECORDING);
    const [state, setState] = React.useState<DictationState>('idle');
    // The wave: the last readings of how loud the room is, newest last. The
    // recorder reports in dBFS, where silence sits near -60 and speech near
    // -20, so that band is stretched to 0–1.
    const status = useAudioRecorderState(recorder, 80);
    const [levels, setLevels] = React.useState<readonly number[]>([]);
    const metering = state === 'recording' ? status.metering : undefined;
    React.useEffect(() => {
        if (state !== 'recording') {
            setLevels([]);
            return;
        }
        const db = typeof metering === 'number' && Number.isFinite(metering) ? metering : -60;
        const level = Math.min(1, Math.max(0, (db + 50) / 40));
        setLevels((previous) => [...previous.slice(-(DICTATION_WAVE_BARS - 1)), level]);
    }, [state, metering, status.durationMillis]);
    // Guards the async gap between a tap and the recorder actually running, so a
    // double tap cannot start two recordings or stop one that never began.
    const pending = React.useRef(false);
    const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    const stopTimer = React.useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = undefined;
        }
    }, []);
    React.useEffect(() => stopTimer, [stopTimer]);

    const finish = React.useCallback(async () => {
        stopTimer();
        setState('transcribing');
        // Read before stop(): the recorder resets its clock on the way down.
        const duration = Math.round(recorder.currentTime * 1000);
        try {
            await recorder.stop();
            const uri = recorder.uri;
            if (!uri) {
                throw new Error(t('kissopen.dictation.nothingRecorded'));
            }
            const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
            const data = await new File(uri).base64();
            const result = await client.transcribe(MIME_BY_EXTENSION[extension] ?? 'audio/m4a', data, duration);
            const text = result.text.trim();
            if (text) {
                onText(text);
            }
        } catch (e) {
            Modal.alert(t('kissopen.dictation.title'), e instanceof Error ? e.message : t('kissopen.dictation.recognitionFailed'));
        } finally {
            setState('idle');
            pending.current = false;
        }
    }, [onText, recorder, stopTimer]);

    const toggle = React.useCallback(() => {
        if (state === 'recording') {
            void finish();
            return;
        }
        if (state === 'transcribing' || pending.current) {
            return;
        }
        pending.current = true;
        void (async () => {
            const permission = await requestMicrophonePermission();
            if (!permission.granted) {
                pending.current = false;
                showMicrophonePermissionDeniedAlert(permission.canAskAgain);
                return;
            }
            try {
                await recorder.prepareToRecordAsync();
                recorder.record();
                setState('recording');
                timer.current = setTimeout(() => void finish(), MAX_DURATION_MS);
            } catch {
                pending.current = false;
                Modal.alert(t('kissopen.dictation.title'), t('kissopen.dictation.recordingFailed'));
            }
        })();
    }, [finish, recorder, state]);

    return { state, toggle, levels };
}
