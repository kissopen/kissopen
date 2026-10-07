import * as React from 'react';
import { AppState } from 'react-native';
import { client } from './api/client';
import type { HomeDemo, Persona } from './api/types';
import { homeDemoKey } from './personaAnswers';

/**
 * The home page's demonstration, while the home is on screen.
 *
 * The server writes it with a model, which takes longer than one request may
 * wait: the first answer is often "writing", and asking again later returns
 * it. So this asks, and while the answer is "writing" asks again every few
 * seconds until the demonstration is there. A failed ask is retried the same
 * way rather than shown — the page keeps its skeleton meanwhile. Once there,
 * the demonstration is kept for as long as the account, and what it said
 * about its work, stay the same; changing the answers asks again.
 */
export function useHomeDemo(active: boolean, accountId: string | undefined, persona: Persona | null | undefined) {
    const key = homeDemoKey(accountId, persona);
    const [demo, setDemo] = React.useState<HomeDemo>();
    const kept = React.useRef<{ key?: string; demo?: HomeDemo }>({});
    if (kept.current.key !== key) kept.current = { key };
    React.useEffect(() => {
        setDemo(kept.current.demo);
        if (!active || !key || kept.current.demo) return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const ask = async () => {
            if (!alive) return;
            if (AppState.currentState === 'background') { timer = setTimeout(() => void ask(), 3000); return; }
            try {
                const status = await client.homeDemo();
                if (!alive) return;
                if (status.demo) {
                    kept.current.demo = status.demo;
                    setDemo(status.demo);
                    return;
                }
            } catch {
                if (!alive) return;
            }
            timer = setTimeout(() => void ask(), 3000);
        };
        void ask();
        return () => { alive = false; if (timer) clearTimeout(timer); };
    }, [active, key]);
    return demo;
}
