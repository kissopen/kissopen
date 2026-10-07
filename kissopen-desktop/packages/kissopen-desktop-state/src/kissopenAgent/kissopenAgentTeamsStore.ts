import type { CloudOrganization, KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import { createStore } from "zustand/vanilla";
import type { UserError } from "../types.js";
import { kissopenAgentUserError, referencesPreserve } from "./kissopenAgentSupport.js";

export const MINIMUM_KISSOPEN_AGENT_TEAMS_VERSION = "0.4.29";
const TEAMS_POLL_INTERVAL_MS = 10_000;

export interface KissopenAgentTeam {
    readonly id: string;
    readonly name: string;
}

export interface KissopenAgentTeamsMutation {
    readonly kind: "teamCreate";
    readonly name: string;
}

export interface KissopenAgentTeamsSnapshot {
    readonly status: "loading" | "ready" | "error";
    readonly teams: readonly KissopenAgentTeam[];
    readonly teamCreateOpen: boolean;
    readonly teamName: string;
    readonly mutation?: KissopenAgentTeamsMutation;
    readonly error?: UserError;
    readonly teamCreateError?: UserError;
}

export interface KissopenAgentTeamsStore {
    get(): KissopenAgentTeamsSnapshot;
    subscribe(listener: () => void): () => void;
    teamCreateClose(): void;
    teamCreateOpen(): void;
    teamCreate(): void;
    teamNameUpdate(value: string): void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentTeamsStoreDeps {
    readonly client: Pick<
        KissopenAgentClient,
        "createCloudOrganization" | "listCloudOrganizations"
    >;
}

const EMPTY: KissopenAgentTeamsSnapshot = {
    status: "loading",
    teamCreateOpen: false,
    teamName: "",
    teams: [],
};
const UNAVAILABLE: KissopenAgentTeamsSnapshot = { ...EMPTY, status: "error" };

/** The on-demand, daemon-backed teams surface for one supported Kissopen Agent installation. */
export function kissopenAgentTeamsStoreCreate(
    deps: KissopenAgentTeamsStoreDeps,
): KissopenAgentTeamsStore {
    const store = createStore<KissopenAgentTeamsSnapshot>()(() => EMPTY);
    const listeners = new Set<() => void>();
    let controller: AbortController | undefined;
    let mutationController: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const timerCancel = (): void => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
    };

    const schedule = (): void => {
        if (disposed || listeners.size === 0 || timer !== undefined || store.getState().mutation)
            return;
        timer = setTimeout(() => {
            timer = undefined;
            teamsLoad();
        }, TEAMS_POLL_INTERVAL_MS);
    };

    const teamsAdopt = (teams: readonly KissopenAgentTeam[]): void => {
        const current = store.getState();
        store.setState(
            {
                error: undefined,
                status: "ready",
                teams: referencesPreserve(current.teams, teams),
            },
            false,
        );
    };

    const teamsLoad = (): void => {
        if (disposed || listeners.size === 0 || controller || store.getState().mutation) return;
        timerCancel();
        const active = new AbortController();
        controller = active;
        void deps.client
            .listCloudOrganizations({ signal: active.signal })
            .then(
                (response) => {
                    if (disposed || controller !== active || active.signal.aborted) return;
                    teamsAdopt(response.organizations.map(teamProject));
                },
                (error: unknown) => {
                    if (disposed || controller !== active || active.signal.aborted) return;
                    store.setState(
                        { error: kissopenAgentUserError(error), status: "error" },
                        false,
                    );
                },
            )
            .finally(() => {
                if (controller !== active) return;
                controller = undefined;
                schedule();
            });
    };

    const pollingStop = (): void => {
        timerCancel();
        controller?.abort();
        controller = undefined;
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            if (listeners.size === 1) teamsLoad();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size === 0) pollingStop();
            };
        },
        teamCreateClose() {
            const current = store.getState();
            if (disposed || current.mutation) return;
            store.setState(
                { teamCreateError: undefined, teamCreateOpen: false, teamName: "" },
                false,
            );
        },
        teamCreateOpen() {
            const current = store.getState();
            if (disposed || current.status !== "ready" || current.mutation) return;
            store.setState(
                { teamCreateError: undefined, teamCreateOpen: true, teamName: "" },
                false,
            );
        },
        teamCreate() {
            const current = store.getState();
            if (
                disposed ||
                current.status !== "ready" ||
                !current.teamCreateOpen ||
                current.mutation
            )
                return;
            const result = teamNameNormalize(current.teamName);
            if (result.error) {
                store.setState({ teamCreateError: kissopenAgentUserError(result.error) }, false);
                return;
            }

            pollingStop();
            const active = new AbortController();
            mutationController = active;
            store.setState(
                {
                    mutation: { kind: "teamCreate", name: result.name },
                    teamCreateError: undefined,
                },
                false,
            );
            void (async () => {
                let created: KissopenAgentTeam | undefined;
                try {
                    const response = await deps.client.createCloudOrganization(
                        { mutationId: globalThis.crypto.randomUUID(), name: result.name },
                        { signal: active.signal },
                    );
                    if (disposed || active.signal.aborted) return;
                    created = teamProject(response.organization);
                    teamsAdopt(teamUpsert(store.getState().teams, created));
                    store.setState({ teamCreateOpen: false, teamName: "" }, false);
                    const refreshed = await deps.client.listCloudOrganizations({
                        signal: active.signal,
                    });
                    if (disposed || active.signal.aborted) return;
                    teamsAdopt(refreshed.organizations.map(teamProject));
                    store.setState({ mutation: undefined }, false);
                } catch (error: unknown) {
                    if (disposed || active.signal.aborted) return;
                    store.setState(
                        created
                            ? {
                                  error: kissopenAgentUserError(error),
                                  mutation: undefined,
                                  status: "error",
                              }
                            : {
                                  mutation: undefined,
                                  teamCreateError: kissopenAgentUserError(error),
                              },
                        false,
                    );
                }
            })().finally(() => {
                if (mutationController === active) mutationController = undefined;
                schedule();
            });
        },
        teamNameUpdate(value) {
            const current = store.getState();
            if (disposed || !current.teamCreateOpen || current.mutation) return;
            store.setState({ teamCreateError: undefined, teamName: value }, false);
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            pollingStop();
            mutationController?.abort();
            mutationController = undefined;
            listeners.clear();
        },
    };
}

function teamProject(organization: CloudOrganization): KissopenAgentTeam {
    return { id: organization.id, name: organization.name };
}

function teamUpsert(
    teams: readonly KissopenAgentTeam[],
    created: KissopenAgentTeam,
): readonly KissopenAgentTeam[] {
    const existing = teams.findIndex((team) => team.id === created.id);
    if (existing < 0) return [...teams, created];
    return teams.map((team, index) => (index === existing ? created : team));
}

function teamNameNormalize(value: string): { readonly name: string; readonly error?: Error } {
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (
            codePoint === undefined ||
            codePoint <= 0x1f ||
            (codePoint >= 0x7f && codePoint <= 0x9f) ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
            /\p{Cf}/u.test(character)
        ) {
            return {
                name: value,
                error: new Error("Team names cannot contain control characters."),
            };
        }
    }
    const name = value.trim();
    const length = [...name].length;
    if (length === 0) return { name, error: new Error("Enter a team name.") };
    if (length > 255)
        return { name, error: new Error("Use 255 characters or fewer for the team name.") };
    return { name };
}

/** A settled stand-in for hosts that do not expose a supported Teams surface. */
export const kissopenAgentTeamsStoreNoop: KissopenAgentTeamsStore = {
    get: () => UNAVAILABLE,
    subscribe: () => () => undefined,
    teamCreateClose: () => undefined,
    teamCreateOpen: () => undefined,
    teamCreate: () => undefined,
    teamNameUpdate: () => undefined,
    [Symbol.dispose]: () => undefined,
};
