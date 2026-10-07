import { createStore } from "zustand/vanilla";
import { t } from "../i18n/locale.js";
import type { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";

/** The one human identity this installation authors work as. */
export interface KissopenAgentProfile {
    readonly email: string;
    readonly name: string;
    readonly updatedAt: number;
    readonly photo?: {
        readonly imageUrl: string;
        readonly width: number;
        readonly height: number;
        readonly thumbhash: string;
    };
}

export interface KissopenAgentProfileSource {
    /**
     * Reports the stored profile whenever it changes, or `undefined` while this
     * installation has never been given one.
     */
    subscribe(
        listener: (profile: KissopenAgentProfile | undefined) => void,
        onError: (error: unknown) => void,
    ): () => void;
}

export interface KissopenAgentProfileActions {
    profileSave(input: {
        readonly email: string;
        readonly name: string;
    }): Promise<KissopenAgentProfile>;
}

export interface KissopenAgentProfileSnapshot {
    /** The values in the fields, which are the stored ones until they are edited. */
    readonly email: string;
    readonly name: string;
    /** True while the fields differ from what is stored. */
    readonly dirty: boolean;
    readonly loading: boolean;
    readonly saving: boolean;
    /** The stored profile could not be read. */
    readonly error?: UserError;
    /** The last save was refused or failed. */
    readonly saveError?: string;
    readonly photo?: KissopenAgentProfile["photo"];
}

export interface KissopenAgentProfileStore {
    get(): KissopenAgentProfileSnapshot;
    subscribe(listener: () => void): () => void;
    displayNameUpdate(value: string): void;
    emailUpdate(value: string): void;
    /** Puts the fields back to what is stored. */
    profileRevert(): void;
    profileSave(): Promise<void>;
    [Symbol.dispose](): void;
}

export interface KissopenAgentProfileStoreDeps {
    readonly source: KissopenAgentProfileSource;
    readonly actions: KissopenAgentProfileActions;
}

const EMPTY: KissopenAgentProfileSnapshot = {
    dirty: false,
    email: "",
    loading: true,
    name: "",
    saving: false,
};

/**
 * The installation profile, edited in place: the snapshot's `name` and `email`
 * are what the fields show, and they follow the stored profile until the reader
 * changes one. Live for exactly as long as a surface is observing it.
 */
export function kissopenAgentProfileStoreCreate(
    deps: KissopenAgentProfileStoreDeps,
): KissopenAgentProfileStore {
    const store = createStore<KissopenAgentProfileSnapshot>()(() => EMPTY);
    const listeners = new Set<() => void>();
    let stored: KissopenAgentProfile | undefined;
    let unsubscribeSource: (() => void) | undefined;
    let disposed = false;

    const dirtyAgainst = (
        profile: KissopenAgentProfile | undefined,
        fields: { readonly email: string; readonly name: string },
    ): boolean => fields.name !== (profile?.name ?? "") || fields.email !== (profile?.email ?? "");

    const profileInput = (profile: KissopenAgentProfile | undefined): void => {
        if (disposed) return;
        stored = profile;
        const current = store.getState();
        // An edit in progress is the reader's, so an authoritative read replaces
        // the fields only while they still show what was stored.
        const adopt = !current.dirty && !current.saving;
        const fields = adopt
            ? { email: profile?.email ?? "", name: profile?.name ?? "" }
            : { email: current.email, name: current.name };
        const dirty = dirtyAgainst(profile, fields);
        const photo = profile?.photo;
        if (
            fields.email === current.email &&
            fields.name === current.name &&
            dirty === current.dirty &&
            current.loading === false &&
            current.error === undefined &&
            current.photo === photo
        )
            return;
        store.setState({
            ...current,
            ...fields,
            dirty,
            loading: false,
            error: undefined,
            ...(photo === undefined ? { photo: undefined } : { photo }),
        });
    };

    const fieldUpdate = (fields: { readonly email?: string; readonly name?: string }): void => {
        const current = store.getState();
        if (current.saving) return;
        const next = {
            email: fields.email ?? current.email,
            name: fields.name ?? current.name,
        };
        if (
            next.email === current.email &&
            next.name === current.name &&
            current.saveError === undefined
        )
            return;
        store.setState({
            ...current,
            ...next,
            dirty: dirtyAgainst(stored, next),
            saveError: undefined,
        });
    };

    const start = (): void => {
        if (disposed || unsubscribeSource) return;
        unsubscribeSource = deps.source.subscribe(profileInput, (error) => {
            if (disposed) return;
            store.setState({
                ...store.getState(),
                loading: false,
                error: kissopenAgentUserError(error),
            });
        });
    };

    const stop = (): void => {
        unsubscribeSource?.();
        unsubscribeSource = undefined;
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            start();
            return () => {
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size === 0) stop();
            };
        },
        displayNameUpdate(value) {
            fieldUpdate({ name: value });
        },
        emailUpdate(value) {
            fieldUpdate({ email: value });
        },
        profileRevert() {
            const current = store.getState();
            if (current.saving) return;
            store.setState({
                ...current,
                dirty: false,
                email: stored?.email ?? "",
                name: stored?.name ?? "",
                saveError: undefined,
            });
        },
        async profileSave() {
            const current = store.getState();
            if (current.saving) return;
            const email = current.email.trim();
            const name = current.name.trim();
            if (!name) {
                store.setState({ ...current, saveError: t("Enter the name to author work as.") });
                return;
            }
            if (!email || !email.includes("@")) {
                store.setState({
                    ...current,
                    saveError: t("Enter the email used for Git commits."),
                });
                return;
            }
            store.setState({
                ...current,
                email,
                name,
                saving: true,
                saveError: undefined,
            });
            try {
                const profile = await deps.actions.profileSave({ email, name });
                if (disposed) return;
                store.setState({ ...store.getState(), saving: false });
                profileInput(profile);
            } catch (error) {
                if (disposed) return;
                store.setState({
                    ...store.getState(),
                    saving: false,
                    saveError: kissopenAgentUserError(error).message,
                });
            }
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            stop();
            listeners.clear();
        },
    };
}

const NO_PROFILE: KissopenAgentProfileSnapshot = { ...EMPTY, loading: false };

export const kissopenAgentProfileStoreNoop: KissopenAgentProfileStore = {
    get: () => NO_PROFILE,
    subscribe: () => () => undefined,
    displayNameUpdate: () => undefined,
    emailUpdate: () => undefined,
    profileRevert: () => undefined,
    profileSave: () => Promise.resolve(),
    [Symbol.dispose]: () => undefined,
};
