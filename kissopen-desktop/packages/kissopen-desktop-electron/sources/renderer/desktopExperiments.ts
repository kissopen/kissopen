import type { ExperimentsDocument, ExperimentsPersistence } from "kissopen-desktop-state";

const EXPERIMENTS_KEY = "kissopen.experiments.v1";

/**
 * Where this machine remembers whether the reader asked for the unfinished
 * features. It is deliberately the window's own storage rather than anything a
 * Kissopen Agent holds: the choice is about what this app offers, so it has to survive a
 * connection going away and must never follow the reader onto another machine.
 */
export function desktopExperimentsPersistence(): ExperimentsPersistence {
    return {
        read() {
            try {
                const value = localStorage.getItem(EXPERIMENTS_KEY);
                return value ? (JSON.parse(value) as ExperimentsDocument) : undefined;
            } catch {
                return undefined;
            }
        },
        write(document) {
            try {
                localStorage.setItem(EXPERIMENTS_KEY, JSON.stringify(document));
            } catch {
                // A storage-denied renderer still honours the choice for as long
                // as the window stays open.
            }
        },
    };
}
