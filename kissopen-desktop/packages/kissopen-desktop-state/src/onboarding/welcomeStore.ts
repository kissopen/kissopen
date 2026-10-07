/**
 * Whether the person has been welcomed to Kissopen on this machine yet, and
 * whether they have asked for this machine to be set up.
 *
 * First-run setup derives every stage it shows from a fact it can check again —
 * whether Node is there, whether Kissopen Agent is installed, whether this Kissopen Agent has ever
 * been used — which is what lets an interrupted setup resume truthfully instead
 * of at a position someone remembered. Two things have no such fact behind them:
 * nothing about the machine says whether its owner has read a slogan, and
 * nothing says whether they want an agent on this computer at all. An account
 * works without one — the cloud workspace answers from anywhere — so installing
 * one is a choice, not a step, and the choice is kept here beside the welcome:
 * a window-level record the host stores, in the same way the sidebar
 * arrangement and the experiments switch are.
 *
 * Following the state principles, the constructor opens nothing: it reads the
 * host's record once, and writes back only when something is decided.
 */
export interface WelcomeDocument {
    readonly welcomeAcknowledged: boolean;
    /** The person asked for KISSOPEN Agent to be installed on this machine. */
    readonly agentSetupChosen: boolean;
}

/**
 * Where that answer is kept. The state package never names a storage medium: the
 * host supplies one, and omitting it means the welcome is shown once per window
 * rather than once per machine.
 */
export interface WelcomePersistence {
    read(): WelcomeDocument | undefined;
    write(document: WelcomeDocument): void;
}

export interface WelcomeSnapshot {
    /** False until the person has read the welcome and asked to go on. */
    readonly welcomeAcknowledged: boolean;
    /**
     * False until the person has asked for this machine to run KISSOPEN Agent.
     * Until then nothing is downloaded or started here, and the window works
     * from the account's cloud workspace alone.
     */
    readonly agentSetupChosen: boolean;
}

export interface WelcomeStore {
    get(): WelcomeSnapshot;
    subscribe(listener: () => void): () => void;
    /** Records that the welcome has been read, for good, on this machine. */
    welcomeAcknowledge(): void;
    /** Records that this machine is to be set up, for good. */
    agentSetupChoose(): void;
}

/**
 * A stored record read back as this window's own value.
 *
 * The document comes from the host's storage, which an older version of this app
 * wrote and a person can edit by hand, so anything that is not the answer this
 * version knows is treated as no record at all — which shows the welcome again,
 * the safe way to be wrong.
 *
 * A record with the welcome but no choice was written before the choice existed,
 * when going past the welcome was asking for the agent. Reading it as that
 * choice keeps a machine that already has its agent from being offered one.
 */
function documentParse(value: unknown): WelcomeDocument | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const { welcomeAcknowledged, agentSetupChosen } = value as {
        welcomeAcknowledged?: unknown;
        agentSetupChosen?: unknown;
    };
    if (typeof welcomeAcknowledged !== "boolean") return undefined;
    return {
        welcomeAcknowledged,
        agentSetupChosen:
            typeof agentSetupChosen === "boolean" ? agentSetupChosen : welcomeAcknowledged,
    };
}

const UNWELCOMED: WelcomeSnapshot = { welcomeAcknowledged: false, agentSetupChosen: false };

export function welcomeStoreCreate(persistence?: WelcomePersistence): WelcomeStore {
    let snapshot: WelcomeSnapshot = (() => {
        try {
            return documentParse(persistence?.read()) ?? UNWELCOMED;
        } catch {
            // Storage the host refused is a machine with no record, which is the
            // same as one whose owner has never been welcomed.
            return UNWELCOMED;
        }
    })();
    const listeners = new Set<() => void>();

    const record = (next: WelcomeSnapshot) => {
        snapshot = next;
        try {
            persistence?.write(snapshot);
        } catch {
            // A storage-denied renderer still moves this window on, so neither
            // answer is a screen a person cannot get past.
        }
        for (const listener of listeners) listener();
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        welcomeAcknowledge() {
            if (snapshot.welcomeAcknowledged) return;
            record({ ...snapshot, welcomeAcknowledged: true });
        },
        agentSetupChoose() {
            if (snapshot.agentSetupChosen) return;
            record({ ...snapshot, agentSetupChosen: true });
        },
    };
}

/**
 * The store a host that remembers nothing stands in. It reports an unwelcomed
 * machine and never changes, so the welcome is shown and acknowledging it moves
 * nothing — which is why a real host always supplies persistence.
 */
export const welcomeStoreNoop: WelcomeStore = {
    get: () => UNWELCOMED,
    subscribe: () => () => {},
    welcomeAcknowledge: () => {},
    agentSetupChoose: () => {},
};
