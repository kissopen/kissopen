import * as React from 'react';
import { api } from './api/client';

/** What this account asked to hear about when a scheduled task finishes. */
export type NotificationChoice = 'all' | 'failures' | 'off';

/**
 * The choice, read from the server and written back.
 *
 * Kept on the account rather than on this phone: somebody who turned results
 * off on one device did not ask to keep receiving them on another. Until the
 * server answers, the default is shown, which is every result — the same thing
 * the server would say.
 */
export function useNotificationChoice(enabled: boolean): {
    choice: NotificationChoice;
    busy: boolean;
    set(next: NotificationChoice): Promise<void>;
} {
    const [choice, setChoice] = React.useState<NotificationChoice>('all');
    const [busy, setBusy] = React.useState(false);
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    React.useEffect(() => {
        if (!enabled) return;
        void (async () => {
            try {
                const body = await api<{ schedules?: NotificationChoice }>('/notifications');
                if (alive.current && body.schedules) setChoice(body.schedules);
            } catch {
                // The default stands. A preference nobody could read is not
                // worth an error on a page about something else.
            }
        })();
    }, [enabled]);

    const set = React.useCallback(async (next: NotificationChoice) => {
        if (busy) return;
        setBusy(true);
        const before = choice;
        setChoice(next);
        try {
            await api('/notifications', 'POST', { schedules: next });
        } catch (e) {
            if (alive.current) setChoice(before);
            throw e;
        } finally {
            if (alive.current) setBusy(false);
        }
    }, [busy, choice]);

    return { choice, busy, set };
}
