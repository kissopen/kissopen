import type { KissopenAgentClient, Secret } from "@kissopen/kissopen-agent-client";
import { createStore } from "zustand/vanilla";
import { UserError } from "../types.js";
import { deepEqual, kissopenAgentUserError } from "./kissopenAgentSupport.js";

/** One environment variable supplied only while creating a secret. */
export interface KissopenAgentSecretEnvironmentVariableInput {
    readonly name: string;
    readonly value: string;
}

/** The write-only input for one new environment-bundle secret. */
export interface KissopenAgentSecretCreateInput {
    readonly availableToAgents: boolean;
    readonly description: string;
    readonly environmentVariables: readonly KissopenAgentSecretEnvironmentVariableInput[];
}

/** Safe secret metadata. Environment values never enter this shape. */
export interface KissopenAgentSecret {
    readonly availableToAgents: boolean;
    readonly createdAt: number;
    readonly description: string;
    readonly environmentVariables: readonly string[];
    readonly id: string;
    readonly managed: boolean;
    readonly updatedAt: number;
    readonly version: string;
}

export interface KissopenAgentSecretsSnapshot {
    /** Why the first list read failed. A later successful poll clears it. */
    readonly error?: UserError;
    /** True until the daemon first answers for the global list. */
    readonly loading: boolean;
    /** Every global secret, as safe metadata only. */
    readonly secrets: readonly KissopenAgentSecret[];
}

/** The global secrets list and its write-only create action. */
export interface KissopenAgentSecretsStore {
    get(): KissopenAgentSecretsSnapshot;
    subscribe(listener: () => void): () => void;
    /** Creates one secret and rejects with a displayable refusal. */
    secretCreate(input: KissopenAgentSecretCreateInput): Promise<void>;
    [Symbol.dispose](): void;
}

export interface KissopenAgentSecretsStoreDeps {
    readonly client: Pick<KissopenAgentClient, "createSecret" | "listSecrets">;
}

const EMPTY: KissopenAgentSecretsSnapshot = { loading: true, secrets: [] };
const SECRETS_POLL_INTERVAL_MS = 4_000;
const SECRETS_PAGE_SIZE = 100;

/**
 * Global environment-bundle secrets.
 *
 * The daemon has secret events, but this secondary settings surface does not
 * yet consume that stream. It polls only while watched and stops on the last
 * unsubscribe. Raw values remain local to the caller and the outgoing create
 * body; only the daemon's safe metadata response is ever published.
 */
export function kissopenAgentSecretsStoreCreate(
    deps: KissopenAgentSecretsStoreDeps,
): KissopenAgentSecretsStore {
    const store = createStore<KissopenAgentSecretsSnapshot>()(() => EMPTY);
    const listeners = new Set<() => void>();
    const mutations = new Set<AbortController>();
    let disposed = false;
    let readController: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timerCancel = (): void => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
    };

    const schedule = (): void => {
        if (disposed || listeners.size === 0 || timer !== undefined) return;
        timer = setTimeout(() => {
            timer = undefined;
            load();
        }, SECRETS_POLL_INTERVAL_MS);
    };

    const settleProjected = (next: readonly KissopenAgentSecret[]): void => {
        const current = store.getState();
        const secrets = secretReferencesPreserve(current.secrets, next);
        store.setState({ loading: false, secrets }, true);
    };

    const settle = (next: readonly Secret[]): void => settleProjected(next.map(secretProject));

    const readAll = async (controller: AbortController): Promise<readonly Secret[]> => {
        const secrets: Secret[] = [];
        let cursor: string | undefined;
        do {
            const page = await deps.client.listSecrets(
                { limit: SECRETS_PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) },
                { signal: controller.signal },
            );
            secrets.push(...page.secrets);
            const next = page.nextCursor ?? undefined;
            if (next !== undefined && next === cursor)
                throw new Error("KissOpen Agent returned a repeating secrets cursor.");
            cursor = next;
        } while (cursor !== undefined);
        return secrets;
    };

    const load = (): void => {
        if (disposed || listeners.size === 0 || readController !== undefined) return;
        timerCancel();
        const controller = new AbortController();
        readController = controller;
        void readAll(controller).then(
            (secrets) => {
                if (disposed || readController !== controller) return;
                readController = undefined;
                settle(secrets);
                schedule();
            },
            (error: unknown) => {
                if (disposed || readController !== controller || controller.signal.aborted) return;
                readController = undefined;
                if (store.getState().loading)
                    store.setState({ error: kissopenAgentUserError(error), loading: false }, false);
                schedule();
            },
        );
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            if (listeners.size === 1) load();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size !== 0) return;
                timerCancel();
                readController?.abort();
                readController = undefined;
            };
        },
        async secretCreate(input) {
            if (disposed) throw new UserError("The secrets store is no longer available.");
            // A read started before this write could answer afterward with the
            // old list. Stop it; the authoritative create response is adopted
            // immediately and the ordinary poll resumes from there.
            timerCancel();
            readController?.abort();
            readController = undefined;
            const controller = new AbortController();
            mutations.add(controller);
            const mutationId = globalThis.crypto.randomUUID();
            try {
                const response = await deps.client.createSecret(
                    {
                        availableToAgents: input.availableToAgents,
                        description: input.description,
                        environment: Object.fromEntries(
                            input.environmentVariables.map(({ name, value }) => [name, value]),
                        ),
                        mutationId,
                    },
                    { signal: controller.signal },
                );
                if (disposed) return;
                const current = store.getState();
                settleProjected([
                    secretProject(response.secret),
                    ...current.secrets.filter((secret) => secret.id !== response.secret.id),
                ]);
            } catch (error) {
                throw kissopenAgentUserError(error);
            } finally {
                mutations.delete(controller);
                schedule();
            }
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            timerCancel();
            readController?.abort();
            readController = undefined;
            for (const controller of mutations) controller.abort();
            mutations.clear();
            listeners.clear();
        },
    };
}

function secretProject(secret: Secret): KissopenAgentSecret {
    return {
        availableToAgents: secret.availableToAgents,
        createdAt: secret.createdAt,
        description: secret.description,
        environmentVariables: secret.environmentVariables,
        id: secret.id,
        managed: secret.managed,
        updatedAt: secret.updatedAt,
        version: secret.version,
    };
}

/** Keeps unchanged entities stable even when a new secret moves their indexes. */
function secretReferencesPreserve(
    previous: readonly KissopenAgentSecret[],
    next: readonly KissopenAgentSecret[],
): readonly KissopenAgentSecret[] {
    const previousById = new Map(previous.map((secret) => [secret.id, secret]));
    const merged = next.map((secret) => {
        const before = previousById.get(secret.id);
        return before !== undefined && deepEqual(before, secret) ? before : secret;
    });
    return merged.length === previous.length &&
        merged.every((secret, index) => previous[index] === secret)
        ? previous
        : merged;
}

const UNAVAILABLE: KissopenAgentSecretsSnapshot = { loading: false, secrets: [] };

/** A settled stand-in when this window has no Kissopen Agent secrets capability. */
export const kissopenAgentSecretsStoreNoop: KissopenAgentSecretsStore = {
    get: () => UNAVAILABLE,
    subscribe: () => () => undefined,
    secretCreate: () => Promise.reject(new UserError("This KissOpen Agent is unavailable.")),
    [Symbol.dispose]: () => undefined,
};
