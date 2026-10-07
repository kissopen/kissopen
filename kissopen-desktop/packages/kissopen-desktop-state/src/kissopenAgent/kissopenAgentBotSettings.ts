import { createStore } from "zustand/vanilla";
import {
    BOT_CORE_FILE_NAMES,
    KISSOPEN_AGENT_BOT_SETTINGS_PROTOCOL_VERSION,
    KissopenAgentApiError,
    type Bot,
    type BotCoreFile,
    type BotCoreFileName,
    type BotCoreFileRevision,
    type BotModel,
    type BotUser,
    type ImageMimeType,
    type KissopenAgentClient,
    type UpdateBotRequest,
} from "@kissopen/kissopen-agent-client";

import type { Loadable } from "../conversation/loadable.js";
import { t } from "../i18n/locale.js";
import { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";
import type { KissopenAgentModelCatalog } from "./kissopenAgentTypes.js";

/** The two pages of an assistant's settings. */
export type KissopenAgentBotSettingsTab = "identity" | "files";

/** One model an assistant can be set to run on. */
export interface KissopenAgentBotModelChoice {
    /** `providerId/modelId`, unique within the list. */
    readonly key: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly name: string;
}

/** The assistant settings a person edits: what the agent holds, or the draft of it. */
export interface KissopenAgentBotSettingsFields {
    readonly name: string;
    readonly description: string;
    readonly style: string | null;
    readonly model: BotModel | null;
    readonly user: BotUser;
}

/** What the agent holds for the assistant, beyond the fields a person edits. */
export interface KissopenAgentBotSettingsStored extends KissopenAgentBotSettingsFields {
    readonly username: string;
    /** A built-in assistant's kind; its built-in guidance cannot be edited, only copied. */
    readonly systemKey: string | null;
}

/** One core file as the editor holds it. */
export interface KissopenAgentBotCoreFileSnapshot {
    readonly name: BotCoreFileName;
    /** The daemon's own content, shown but never written. */
    readonly locked: boolean;
    /** The file as the agent last confirmed it. */
    readonly stored: BotCoreFile;
    /** What the editor holds. It follows `stored` until someone types. */
    readonly draft: string;
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly saveError?: UserError;
}

/** The recorded history of the selected core file, while it is open. */
export interface KissopenAgentBotFileHistorySnapshot {
    readonly name: BotCoreFileName;
    readonly revisions: Loadable<readonly BotCoreFileRevision[]>;
    /** The revision whose content is being fetched into the draft. */
    readonly restoring?: string;
    readonly restoreError?: UserError;
}

export interface KissopenAgentBotSettingsSnapshot {
    /** The assistant whose settings are open, or null when the dialog is closed. */
    readonly botId: string | null;
    readonly tab: KissopenAgentBotSettingsTab;
    readonly stored: Loadable<KissopenAgentBotSettingsStored>;
    readonly draft: KissopenAgentBotSettingsFields;
    /** The draft says something the agent has not been told yet. */
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly saveError?: UserError;
    readonly modelChoices: readonly KissopenAgentBotModelChoice[];
    readonly avatarUploading: boolean;
    readonly avatarError?: UserError;
    readonly copying: boolean;
    readonly copyError?: UserError;
    /** The name of the copy just made, so the dialog can say where it went. */
    readonly copiedName?: string;
    readonly files: Loadable<readonly KissopenAgentBotCoreFileSnapshot[]>;
    readonly fileSelected: BotCoreFileName;
    readonly history: KissopenAgentBotFileHistorySnapshot | null;
}

/**
 * One assistant's settings dialog: its identity, what it knows about the
 * person, and its core files.
 *
 * Opening it reads the assistant; while it is open and watched it reads again
 * every few seconds, so a memory the assistant just wrote, or a change made on
 * another device, shows up without anyone asking. Drafts a person is typing
 * are never overwritten by such a read.
 */
export interface KissopenAgentBotSettingsStore {
    get(): KissopenAgentBotSettingsSnapshot;
    subscribe(listener: () => void): () => void;
    dialogOpen(botId: string): void;
    dialogClose(): void;
    tabSelect(tab: KissopenAgentBotSettingsTab): void;
    nameUpdate(value: string): void;
    descriptionUpdate(value: string): void;
    styleUpdate(value: string | null): void;
    modelUpdate(value: BotModel | null): void;
    userNameUpdate(value: string): void;
    userLanguageUpdate(value: string): void;
    userNoteUpdate(value: string): void;
    userBackgroundUpdate(value: string): void;
    /** Sends every changed setting as one change. */
    settingsSave(): void;
    avatarUpload(bytes: Uint8Array<ArrayBuffer>, contentType: ImageMimeType): void;
    /** Makes an editable ordinary assistant from this one. */
    botCopy(name: string): void;
    fileSelect(name: BotCoreFileName): void;
    fileDraftUpdate(text: string): void;
    fileSave(): void;
    fileHistoryOpen(): void;
    fileHistoryClose(): void;
    /** Puts a recorded revision's content into the draft, to be saved like any edit. */
    fileRevisionRestore(revisionId: string): void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentBotSettingsStoreDeps {
    readonly client: Pick<
        KissopenAgentClient,
        | "getHealth"
        | "getBot"
        | "updateBot"
        | "setBotAvatar"
        | "copyBot"
        | "listBotFiles"
        | "writeBotFile"
        | "listBotFileRevisions"
        | "getBotFileRevision"
    >;
    readonly catalogRead: () => Promise<KissopenAgentModelCatalog>;
}

const POLL_INTERVAL_MS = 4_000;

const EMPTY_FIELDS: KissopenAgentBotSettingsFields = {
    name: "",
    description: "",
    style: null,
    model: null,
    user: { name: "", language: "", note: "", background: "" },
};

const CLOSED: KissopenAgentBotSettingsSnapshot = {
    botId: null,
    tab: "identity",
    stored: { type: "unloaded" },
    draft: EMPTY_FIELDS,
    dirty: false,
    saving: false,
    modelChoices: [],
    avatarUploading: false,
    copying: false,
    files: { type: "unloaded" },
    fileSelected: "SOUL.md",
    history: null,
};

function fieldsOf(bot: Bot): KissopenAgentBotSettingsStored {
    return {
        name: bot.name,
        description: bot.description ?? "",
        style: bot.style ?? null,
        model: bot.model ?? null,
        user: bot.user ?? EMPTY_FIELDS.user,
        username: bot.username,
        systemKey: bot.systemKey ?? null,
    };
}

function fieldsEqual(
    left: KissopenAgentBotSettingsFields,
    right: KissopenAgentBotSettingsFields,
): boolean {
    return (
        left.name === right.name &&
        left.description === right.description &&
        left.style === right.style &&
        JSON.stringify(left.model) === JSON.stringify(right.model) &&
        JSON.stringify(left.user) === JSON.stringify(right.user)
    );
}

function editable(fields: KissopenAgentBotSettingsFields): KissopenAgentBotSettingsFields {
    return {
        name: fields.name,
        description: fields.description,
        style: fields.style,
        model: fields.model,
        user: fields.user,
    };
}

export function kissopenAgentBotSettingsStoreCreate(
    deps: KissopenAgentBotSettingsStoreDeps,
): KissopenAgentBotSettingsStore {
    const store = createStore<KissopenAgentBotSettingsSnapshot>()(() => CLOSED);
    const listeners = new Set<() => void>();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    /** The bot version the drafts were read against, for `If-Match`. */
    let version: string | undefined;
    /** Bumped on every open and close, so answers for a dialog that is gone are dropped. */
    let generation = 0;

    const set = (next: Partial<KissopenAgentBotSettingsSnapshot>): void => {
        store.setState(next, false);
    };
    const current = (): KissopenAgentBotSettingsSnapshot => store.getState();

    const timerCancel = (): void => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
    };
    const schedule = (): void => {
        if (disposed || listeners.size === 0 || timer !== undefined) return;
        if (current().botId === null) return;
        timer = setTimeout(() => {
            timer = undefined;
            load();
        }, POLL_INTERVAL_MS);
    };

    /** Takes in the assistant as the agent holds it; the draft follows unless someone is typing. */
    const settleBot = (bot: Bot): void => {
        version = bot.version;
        const stored = fieldsOf(bot);
        const state = current();
        const draft = state.dirty ? state.draft : editable(stored);
        set({
            stored: { type: "ready", value: stored },
            draft,
            dirty: !fieldsEqual(draft, stored),
        });
    };

    /** Takes in the core files; each one being edited keeps its draft. */
    const settleFiles = (files: readonly BotCoreFile[]): void => {
        const state = current();
        const before = state.files.type === "ready" ? state.files.value : [];
        set({
            files: {
                type: "ready",
                value: files.map((file) => {
                    const held = before.find((entry) => entry.name === file.name);
                    if (held !== undefined && held.dirty) {
                        return { ...held, stored: file, dirty: held.draft !== file.content };
                    }
                    if (held !== undefined && held.stored.sha256 === file.sha256 && !held.saving) {
                        return held.stored.updatedAt === file.updatedAt
                            ? held
                            : { ...held, stored: file };
                    }
                    return {
                        name: file.name,
                        locked: file.locked,
                        stored: file,
                        draft: file.content,
                        dirty: false,
                        saving: held?.saving ?? false,
                        ...(held?.saveError === undefined ? {} : { saveError: held.saveError }),
                    };
                }),
            },
        });
    };

    const load = (): void => {
        const botId = current().botId;
        if (disposed || botId === null || loading) return;
        loading = true;
        timerCancel();
        const opened = generation;
        const first = current().stored.type !== "ready";
        if (first) set({ stored: { type: "loading" }, files: { type: "loading" } });
        void (async () => {
            if (first) {
                const health = await deps.client.getHealth();
                if (health.version.protocol < KISSOPEN_AGENT_BOT_SETTINGS_PROTOCOL_VERSION) {
                    throw new UserError(
                        t(
                            "This computer's KissOpen Agent is too old for assistant settings. Update it first.",
                        ),
                    );
                }
            }
            const [bot, files, choices] = await Promise.all([
                deps.client.getBot(botId),
                deps.client.listBotFiles(botId),
                first ? deps.catalogRead() : Promise.resolve(undefined),
            ]);
            return { bot: bot.bot, files: files.files, choices };
        })().then(
            ({ bot, files, choices }) => {
                loading = false;
                if (disposed || opened !== generation) return;
                settleBot(bot);
                settleFiles(files);
                if (choices !== undefined) {
                    set({
                        modelChoices: choices.providers
                            .filter((provider) => provider.enabled)
                            .flatMap((provider) =>
                                provider.models.map((model) => ({
                                    key: `${provider.id}/${model.id}`,
                                    providerId: provider.id,
                                    modelId: model.id,
                                    name: model.name,
                                })),
                            ),
                    });
                }
                schedule();
            },
            (error: unknown) => {
                loading = false;
                if (disposed || opened !== generation) return;
                // A refresh that fails keeps what is on screen; only a first read
                // has nothing to keep and shows why.
                if (first) {
                    const userError = kissopenAgentUserError(error);
                    set({
                        stored: { type: "error", error: userError },
                        files: { type: "error", error: userError },
                    });
                }
                schedule();
            },
        );
    };

    const draftChange = (next: Partial<KissopenAgentBotSettingsFields>): void => {
        const state = current();
        const draft = { ...state.draft, ...next };
        const stored = state.stored.type === "ready" ? state.stored.value : undefined;
        const { saveError: _cleared, ...rest } = state;
        store.setState(
            { ...rest, draft, dirty: stored === undefined || !fieldsEqual(draft, stored) },
            true,
        );
    };

    const fileChange = (
        name: BotCoreFileName,
        change: (file: KissopenAgentBotCoreFileSnapshot) => KissopenAgentBotCoreFileSnapshot,
    ): void => {
        const state = current();
        if (state.files.type !== "ready") return;
        set({
            files: {
                type: "ready",
                value: state.files.value.map((file) => (file.name === name ? change(file) : file)),
            },
        });
    };

    const selectedFile = (): KissopenAgentBotCoreFileSnapshot | undefined => {
        const state = current();
        if (state.files.type !== "ready") return undefined;
        return state.files.value.find((file) => file.name === state.fileSelected);
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
                if (listeners.size === 0) timerCancel();
            };
        },
        dialogOpen(botId) {
            generation += 1;
            version = undefined;
            timerCancel();
            loading = false;
            store.setState({ ...CLOSED, botId }, true);
            load();
        },
        dialogClose() {
            generation += 1;
            version = undefined;
            timerCancel();
            loading = false;
            store.setState(CLOSED, true);
        },
        tabSelect(tab) {
            if (current().tab !== tab) set({ tab });
        },
        nameUpdate(value) {
            draftChange({ name: value });
        },
        descriptionUpdate(value) {
            draftChange({ description: value });
        },
        styleUpdate(value) {
            draftChange({ style: value });
        },
        modelUpdate(value) {
            draftChange({ model: value });
        },
        userNameUpdate(value) {
            draftChange({ user: { ...current().draft.user, name: value } });
        },
        userLanguageUpdate(value) {
            draftChange({ user: { ...current().draft.user, language: value } });
        },
        userNoteUpdate(value) {
            draftChange({ user: { ...current().draft.user, note: value } });
        },
        userBackgroundUpdate(value) {
            draftChange({ user: { ...current().draft.user, background: value } });
        },
        settingsSave() {
            const state = current();
            if (state.botId === null || state.saving || state.stored.type !== "ready") return;
            const stored = state.stored.value;
            const draft = state.draft;
            const change: Omit<UpdateBotRequest, "mutationId" | "username"> = {
                ...(draft.name.trim() !== stored.name ? { name: draft.name.trim() } : {}),
                ...(draft.description !== stored.description
                    ? { description: draft.description }
                    : {}),
                ...(draft.style !== stored.style ? { style: draft.style } : {}),
                ...(JSON.stringify(draft.model) !== JSON.stringify(stored.model)
                    ? { model: draft.model }
                    : {}),
                ...(JSON.stringify(draft.user) !== JSON.stringify(stored.user)
                    ? { user: draft.user }
                    : {}),
            };
            if (Object.keys(change).length === 0 || version === undefined) return;
            if (draft.name.trim() === "") {
                set({ saveError: new UserError(t("An assistant needs a name.")) });
                return;
            }
            const opened = generation;
            const botId = state.botId;
            const { saveError: _cleared, ...rest } = state;
            store.setState({ ...rest, saving: true }, true);
            void deps.client.updateBot(botId, change, { ifMatch: version }).then(
                ({ bot }) => {
                    if (disposed || opened !== generation) return;
                    set({ saving: false, dirty: false });
                    settleBot(bot);
                },
                (error: unknown) => {
                    if (disposed || opened !== generation) return;
                    const conflict = error instanceof KissopenAgentApiError && error.status === 409;
                    set({
                        saving: false,
                        saveError: conflict
                            ? new UserError(
                                  t(
                                      "This assistant was changed somewhere else in the meantime. Close this and open it again.",
                                  ),
                              )
                            : kissopenAgentUserError(error),
                    });
                },
            );
        },
        avatarUpload(bytes, contentType) {
            const state = current();
            if (state.botId === null || state.avatarUploading) return;
            const opened = generation;
            const botId = state.botId;
            const { avatarError: _cleared, ...rest } = state;
            store.setState({ ...rest, avatarUploading: true }, true);
            void (async () => {
                const fresh = await deps.client.getBot(botId);
                return await deps.client.setBotAvatar(
                    botId,
                    { contentType, data: bytes },
                    { ifMatch: fresh.bot.version },
                );
            })().then(
                ({ bot }) => {
                    if (disposed || opened !== generation) return;
                    set({ avatarUploading: false });
                    settleBot(bot);
                },
                (error: unknown) => {
                    if (disposed || opened !== generation) return;
                    set({ avatarUploading: false, avatarError: kissopenAgentUserError(error) });
                },
            );
        },
        botCopy(name) {
            const state = current();
            if (state.botId === null || state.copying) return;
            const opened = generation;
            const { copyError: _cleared, copiedName: _before, ...rest } = state;
            store.setState({ ...rest, copying: true }, true);
            void deps.client
                .copyBot(state.botId, name.trim() === "" ? {} : { name: name.trim() })
                .then(
                    ({ bot }) => {
                        if (disposed || opened !== generation) return;
                        set({ copying: false, copiedName: bot.name });
                    },
                    (error: unknown) => {
                        if (disposed || opened !== generation) return;
                        set({ copying: false, copyError: kissopenAgentUserError(error) });
                    },
                );
        },
        fileSelect(name) {
            const state = current();
            if (state.fileSelected === name) return;
            set({ fileSelected: name, history: null });
        },
        fileDraftUpdate(text) {
            const name = current().fileSelected;
            fileChange(name, (file) => {
                if (file.locked || file.draft === text) return file;
                const { saveError: _cleared, ...rest } = file;
                return { ...rest, draft: text, dirty: text !== file.stored.content };
            });
        },
        fileSave() {
            const state = current();
            const file = selectedFile();
            if (
                state.botId === null ||
                file === undefined ||
                file.locked ||
                file.saving ||
                !file.dirty
            )
                return;
            const opened = generation;
            const name = file.name;
            fileChange(name, (entry) => {
                const { saveError: _cleared, ...rest } = entry;
                return { ...rest, saving: true };
            });
            void deps.client
                .writeBotFile(state.botId, name, {
                    content: file.draft,
                    baseSha256: file.stored.sha256,
                })
                .then(
                    ({ file: written }) => {
                        if (disposed || opened !== generation) return;
                        fileChange(name, (entry) => ({
                            ...entry,
                            stored: written,
                            saving: false,
                            dirty: entry.draft !== written.content,
                        }));
                        const history = current().history;
                        if (history !== null && history.name === name) {
                            set({ history: { name, revisions: { type: "loading" } } });
                            loadHistory(name);
                        }
                    },
                    (error: unknown) => {
                        if (disposed || opened !== generation) return;
                        const conflict =
                            error instanceof KissopenAgentApiError && error.status === 409;
                        fileChange(name, (entry) => ({
                            ...entry,
                            saving: false,
                            saveError: conflict
                                ? new UserError(
                                      error.message ||
                                          t(
                                              "The file changed somewhere else since you started editing.",
                                          ),
                                  )
                                : kissopenAgentUserError(error),
                        }));
                    },
                );
        },
        fileHistoryOpen() {
            const state = current();
            if (state.botId === null) return;
            const name = state.fileSelected;
            set({ history: { name, revisions: { type: "loading" } } });
            loadHistory(name);
        },
        fileHistoryClose() {
            if (current().history !== null) set({ history: null });
        },
        fileRevisionRestore(revisionId) {
            const state = current();
            const history = state.history;
            if (state.botId === null || history === null) return;
            const opened = generation;
            const name = history.name;
            set({ history: { name, revisions: history.revisions, restoring: revisionId } });
            void deps.client.getBotFileRevision(state.botId, name, revisionId).then(
                ({ revision }) => {
                    if (disposed || opened !== generation) return;
                    fileChange(name, (entry) => ({
                        ...entry,
                        draft: revision.content,
                        dirty: revision.content !== entry.stored.content,
                    }));
                    set({ history: null });
                },
                (error: unknown) => {
                    if (disposed || opened !== generation) return;
                    const now = current().history;
                    if (now === null) return;
                    set({
                        history: {
                            name: now.name,
                            revisions: now.revisions,
                            restoreError: kissopenAgentUserError(error),
                        },
                    });
                },
            );
        },
        [Symbol.dispose]() {
            disposed = true;
            timerCancel();
            listeners.clear();
        },
    };

    function loadHistory(name: BotCoreFileName): void {
        const botId = current().botId;
        if (botId === null) return;
        const opened = generation;
        void deps.client.listBotFileRevisions(botId, name).then(
            ({ revisions }) => {
                if (disposed || opened !== generation) return;
                const history = current().history;
                if (history === null || history.name !== name) return;
                set({ history: { name, revisions: { type: "ready", value: revisions } } });
            },
            (error: unknown) => {
                if (disposed || opened !== generation) return;
                const history = current().history;
                if (history === null || history.name !== name) return;
                set({
                    history: {
                        name,
                        revisions: { type: "error", error: kissopenAgentUserError(error) },
                    },
                });
            },
        );
    }
}

/** The core files in the order the dialog lists them. */
export const KISSOPEN_AGENT_BOT_CORE_FILES: readonly BotCoreFileName[] = BOT_CORE_FILE_NAMES;
