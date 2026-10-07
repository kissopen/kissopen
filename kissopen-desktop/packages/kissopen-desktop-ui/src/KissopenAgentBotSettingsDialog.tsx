import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import { AvatarBrutalist } from "./AvatarBrutalist";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ModalOverlay } from "./ModalOverlay";
import { Tabs } from "./Tabs";
import { TextField } from "./TextField";

/** The two pages of an assistant's settings. */
export type KissopenAgentBotSettingsDialogTab = "identity" | "files";

/** One choice in a row of chips: a style, or a model. */
export type KissopenAgentBotSettingsChoice = {
    readonly id: string;
    readonly label: string;
};

/** One core file in the list beside the editor. */
export type KissopenAgentBotSettingsFileItem = {
    readonly name: string;
    /** The daemon's own content, shown but never written. */
    readonly locked: boolean;
    /** It holds an edit that is not saved yet. */
    readonly dirty: boolean;
};

/** One recorded version of the open core file. */
export type KissopenAgentBotSettingsRevision = {
    readonly id: string;
    /** When it was recorded, in the reader's words. */
    readonly label: string;
    /** Who made it and how large it is. */
    readonly detail: string;
};

/** The history of the open core file, while it is showing. */
export type KissopenAgentBotSettingsHistory = {
    readonly status: "loading" | "ready" | "error";
    readonly revisions: readonly KissopenAgentBotSettingsRevision[];
    readonly error?: string;
    /** The revision whose content is being fetched into the editor. */
    readonly restoring?: string;
};

/** What the assistant knows about the person it serves. */
export type KissopenAgentBotSettingsPerson = {
    readonly name: string;
    readonly language: string;
    readonly note: string;
    readonly background: string;
};

export type KissopenAgentBotSettingsDialogProps = {
    /** What the assistant is called now — the name the agent has, not the draft. */
    name: string;
    /** The immutable handle shown under the name. */
    username: string;
    imageUrl?: string;
    /** The identity its generated mark is drawn from when it has no picture, as the sidebar draws it. */
    avatarId?: string;
    /** A built-in assistant: its own guidance can be read but not changed, only copied. */
    builtIn: boolean;
    status: "loading" | "ready" | "error";
    /** Why the settings could not be read, when `status` is `error`. */
    error?: string;
    tab: KissopenAgentBotSettingsDialogTab;
    onTabSelect: (tab: KissopenAgentBotSettingsDialogTab) => void;

    nameDraft: string;
    onNameChange: (value: string) => void;
    description: string;
    onDescriptionChange: (value: string) => void;
    /** The styles the assistant can answer in. */
    tones: readonly KissopenAgentBotSettingsChoice[];
    /** The chosen style, or null for none. */
    tone: string | null;
    onToneChange: (id: string | null) => void;
    models: readonly KissopenAgentBotSettingsChoice[];
    /** The chosen model, or null for Auto. */
    model: string | null;
    onModelChange: (id: string | null) => void;
    avatarUploading: boolean;
    avatarError?: string;
    onAvatarPick: (file: File) => void;
    copying: boolean;
    copyError?: string;
    /** The name of the copy just made. */
    copiedName?: string;
    onCopy: () => void;

    person: KissopenAgentBotSettingsPerson;
    onPersonNameChange: (value: string) => void;
    onPersonLanguageChange: (value: string) => void;
    onPersonNoteChange: (value: string) => void;
    onPersonBackgroundChange: (value: string) => void;

    /** The identity and person fields hold unsaved edits. */
    dirty: boolean;
    saving: boolean;
    saveError?: string;
    onSave: () => void;

    /** Absent while the files are still being read. */
    files?: readonly KissopenAgentBotSettingsFileItem[];
    fileSelected: string;
    onFileSelect: (name: string) => void;
    fileDraft: string;
    onFileDraftChange: (value: string) => void;
    fileLocked: boolean;
    fileDirty: boolean;
    fileSaving: boolean;
    fileSaveError?: string;
    /** When the open file last changed, in the reader's words. */
    fileUpdated?: string;
    onFileSave: () => void;
    history?: KissopenAgentBotSettingsHistory;
    onHistoryOpen: () => void;
    onHistoryClose: () => void;
    onRevisionRestore: (id: string) => void;

    onClose: () => void;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

/** What each core file is for, in one line under the editor. */
const FILE_PURPOSE: Readonly<Record<string, string>> = {
    "SOUL.md": "Its character: values, temperament, and how it treats people.",
    "IDENTITY.md": "Who it is and what it does, beyond its description.",
    "AGENTS.md": "How it works: the operating instructions it follows.",
    "MEMORY.md": "What it has learned and keeps. The assistant updates this itself.",
    "USER.md": "What it knows about you, beyond the fields above.",
};

/**
 * One assistant's settings: who it is, the person it serves, and the core
 * files it reads at the start of every turn.
 *
 * Every value and every change is the caller's; the dialog only lays them out.
 * The identity and person fields are bot settings saved together by the footer's
 * Save. A core file is a file, saved on its own from beside its editor, so an
 * edit to one never waits on or blocks the other.
 */
export function KissopenAgentBotSettingsDialog(props: KissopenAgentBotSettingsDialogProps) {
    const busy = props.saving || props.status !== "ready";
    return (
        <ModalOverlay
            {...(props.dirty || props.fileDirty ? {} : { onDismiss: () => props.onClose() })}
        >
            <Modal
                className={props.className}
                data-testid={props["data-testid"]}
                footer={
                    <>
                        {props.saveError ? (
                            <span className="kissopen-bot-settings__footer-error" role="alert">
                                {props.saveError}
                            </span>
                        ) : null}
                        <Button onClick={() => props.onClose()} variant="ghost">
                            {t("Close")}
                        </Button>
                        <Button
                            disabled={busy || !props.dirty}
                            onClick={() => props.onSave()}
                            variant="primary"
                        >
                            {props.saving ? t("Saving…") : t("Save")}
                        </Button>
                    </>
                }
                icon="settings"
                onClose={() => props.onClose()}
                size="large"
                style={props.style}
                title={t("Assistant settings")}
            >
                <div
                    className="kissopen-bot-settings"
                    data-kissopen-desktop-ui="kissopen-bot-settings"
                >
                    <div className="kissopen-bot-settings__identity">
                        <BotMark {...props} size={40} />
                        <div className="kissopen-bot-settings__identity-text">
                            <span className="kissopen-bot-settings__identity-name">
                                {props.name}
                            </span>
                            <span className="kissopen-bot-settings__identity-meta">
                                @{props.username}
                                {props.builtIn ? ` · ${t("Built-in assistant")}` : ""}
                            </span>
                        </div>
                    </div>
                    <Tabs
                        activeId={props.tab}
                        onSelect={(id) =>
                            props.onTabSelect(id === "files" ? "files" : "identity")
                        }
                        size="small"
                        tabs={[
                            { id: "identity", label: t("Identity"), closable: false },
                            { id: "files", label: t("Core files"), closable: false },
                        ]}
                    />
                    {props.status === "error" ? (
                        <Banner tone="danger" title={t("Could not read this assistant")}>
                            {props.error ?? ""}
                        </Banner>
                    ) : props.status === "loading" ? (
                        <p className="kissopen-bot-settings__quiet">{t("Loading…")}</p>
                    ) : props.tab === "identity" ? (
                        <IdentityPage {...props} />
                    ) : (
                        <FilesPage {...props} />
                    )}
                </div>
            </Modal>
        </ModalOverlay>
    );
}

function IdentityPage(props: KissopenAgentBotSettingsDialogProps) {
    return (
        <div className="kissopen-bot-settings__page">
            <TextField
                disabled={props.saving}
                fullWidth
                label={t("Name")}
                onValueChange={(value) => props.onNameChange(value)}
                required
                value={props.nameDraft}
            />
            <div className="kissopen-bot-settings__field">
                <span className="kissopen-bot-settings__label">{t("Picture")}</span>
                <div className="kissopen-bot-settings__row">
                    <BotMark {...props} size={32} />
                    <label
                        className="kissopen-bot-settings__pick"
                        data-disabled={props.avatarUploading ? "" : undefined}
                    >
                        <Icon name="image" size={16} />
                        {props.avatarUploading ? t("Uploading…") : t("Choose a picture")}
                        <input
                            accept="image/png,image/jpeg,image/webp"
                            className="kissopen-bot-settings__file-input"
                            disabled={props.avatarUploading}
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = "";
                                if (file) props.onAvatarPick(file);
                            }}
                            type="file"
                        />
                    </label>
                </div>
                {props.avatarError ? (
                    <span className="kissopen-bot-settings__error">{props.avatarError}</span>
                ) : null}
            </div>
            <TextField
                disabled={props.saving}
                fullWidth
                label={t("What is this assistant for?")}
                multiline
                onValueChange={(value) => props.onDescriptionChange(value)}
                placeholder={t("For example: finds and summarizes papers on what I am working on.")}
                rows={3}
                value={props.description}
            />
            <ChipRow
                choices={props.tones}
                label={t("Style")}
                onChange={props.onToneChange}
                selected={props.tone}
                unset={t("None")}
            />
            <ChipRow
                choices={props.models}
                label={t("Model")}
                hint={t("Used when another assistant or a schedule messages it. Auto keeps the model it last ran on.")}
                onChange={props.onModelChange}
                selected={props.model}
                unset={t("Auto")}
            />
            <div className="kissopen-bot-settings__copy">
                <div className="kissopen-bot-settings__copy-text">
                    <span className="kissopen-bot-settings__label">{t("Copy as a new assistant")}</span>
                    <span className="kissopen-bot-settings__quiet">
                        {props.builtIn
                            ? t("A built-in assistant's own guidance cannot be changed. A copy starts with the same settings, picture, and files, and all of it is yours to edit.")
                            : t("A copy starts with the same settings, picture, and files, and a conversation of its own.")}
                    </span>
                    {props.copiedName ? (
                        <span className="kissopen-bot-settings__done">
                            {t("Made {name}. It is in your assistant list.", { name: props.copiedName })}
                        </span>
                    ) : null}
                    {props.copyError ? (
                        <span className="kissopen-bot-settings__error">{props.copyError}</span>
                    ) : null}
                </div>
                <Button
                    disabled={props.copying}
                    icon="copy"
                    onClick={() => props.onCopy()}
                    size="small"
                    variant="secondary"
                >
                    {props.copying ? t("Copying…") : t("Copy")}
                </Button>
            </div>
        </div>
    );
}

function FilesPage(props: KissopenAgentBotSettingsDialogProps) {
    const history = props.history;
    return (
        <div className="kissopen-bot-settings__page">
            <span className="kissopen-bot-settings__section">{t("About you")}</span>
            <div className="kissopen-bot-settings__pair">
                <TextField
                    disabled={props.saving}
                    fullWidth
                    label={t("What to call you")}
                    onValueChange={(value) => props.onPersonNameChange(value)}
                    placeholder={t("For example: Steve, or a nickname")}
                    value={props.person.name}
                />
                <TextField
                    disabled={props.saving}
                    fullWidth
                    label={t("Preferred language")}
                    onValueChange={(value) => props.onPersonLanguageChange(value)}
                    placeholder={t("For example: 中文, English")}
                    value={props.person.language}
                />
            </div>
            <TextField
                disabled={props.saving}
                fullWidth
                label={t("Note")}
                onValueChange={(value) => props.onPersonNoteChange(value)}
                placeholder={t("A short note, such as your city or job")}
                value={props.person.note}
            />
            <TextField
                disabled={props.saving}
                fullWidth
                label={t("Background")}
                multiline
                onValueChange={(value) => props.onPersonBackgroundChange(value)}
                placeholder={t("Your work, projects, and preferences…")}
                rows={3}
                value={props.person.background}
            />
            <span className="kissopen-bot-settings__section">{t("Core files")}</span>
            <p className="kissopen-bot-settings__quiet">
                {t("Files in the assistant's folder that it reads at the start of every turn. Each is saved on its own.")}
            </p>
            {props.files === undefined ? (
                <p className="kissopen-bot-settings__quiet">{t("Loading…")}</p>
            ) : (
                <div className="kissopen-bot-settings__files">
                    <div className="kissopen-bot-settings__file-list" role="listbox">
                        {props.files.map((file) => (
                            <button
                                aria-selected={file.name === props.fileSelected}
                                className="kissopen-bot-settings__file"
                                key={file.name}
                                onClick={() => props.onFileSelect(file.name)}
                                role="option"
                                type="button"
                            >
                                <span className="kissopen-bot-settings__file-name">
                                    {file.name}
                                    {file.dirty ? " •" : ""}
                                </span>
                                {file.locked ? <Icon name="lock" size={14} /> : null}
                            </button>
                        ))}
                    </div>
                    <div className="kissopen-bot-settings__editor">
                        <div className="kissopen-bot-settings__editor-head">
                            <span className="kissopen-bot-settings__quiet">
                                {t(FILE_PURPOSE[props.fileSelected] ?? "")}
                            </span>
                            {props.fileLocked ? null : (
                                <Button
                                    icon="history"
                                    onClick={() =>
                                        history === undefined
                                            ? props.onHistoryOpen()
                                            : props.onHistoryClose()
                                    }
                                    size="small"
                                    variant="ghost"
                                >
                                    {history === undefined ? t("History") : t("Hide history")}
                                </Button>
                            )}
                        </div>
                        {history !== undefined ? (
                            <div className="kissopen-bot-settings__history" role="list">
                                {history.status === "loading" ? (
                                    <span className="kissopen-bot-settings__quiet">{t("Loading…")}</span>
                                ) : history.status === "error" ? (
                                    <span className="kissopen-bot-settings__error">{history.error ?? ""}</span>
                                ) : history.revisions.length === 0 ? (
                                    <span className="kissopen-bot-settings__quiet">
                                        {t("No versions recorded yet.")}
                                    </span>
                                ) : (
                                    history.revisions.map((revision) => (
                                        <div className="kissopen-bot-settings__revision" key={revision.id} role="listitem">
                                            <span className="kissopen-bot-settings__revision-text">
                                                <span>{revision.label}</span>
                                                <span className="kissopen-bot-settings__quiet">{revision.detail}</span>
                                            </span>
                                            <Button
                                                disabled={history.restoring !== undefined}
                                                onClick={() => props.onRevisionRestore(revision.id)}
                                                size="small"
                                                variant="ghost"
                                            >
                                                {history.restoring === revision.id ? t("Opening…") : t("Use this version")}
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : null}
                        <TextField
                            aria-label={props.fileSelected}
                            disabled={props.fileLocked || props.fileSaving}
                            fullWidth
                            multiline
                            onValueChange={(value) => props.onFileDraftChange(value)}
                            placeholder={t("Empty. Write here to create the file.")}
                            rows={12}
                            value={props.fileDraft}
                        />
                        <div className="kissopen-bot-settings__editor-foot">
                            <span className="kissopen-bot-settings__quiet">
                                {props.fileLocked
                                    ? t("Built-in guidance. Copy the assistant to change it.")
                                    : (props.fileUpdated ?? "")}
                            </span>
                            {props.fileSaveError ? (
                                <span className="kissopen-bot-settings__error">{props.fileSaveError}</span>
                            ) : null}
                            {props.fileLocked ? null : (
                                <Button
                                    disabled={!props.fileDirty || props.fileSaving}
                                    onClick={() => props.onFileSave()}
                                    size="small"
                                    variant="secondary"
                                >
                                    {props.fileSaving ? t("Saving…") : t("Save file")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** The assistant's picture, or the generated mark the sidebar shows when it has none. */
function BotMark(props: KissopenAgentBotSettingsDialogProps & { size: 32 | 40 }) {
    if (props.imageUrl === undefined && props.avatarId !== undefined)
        return <AvatarBrutalist id={props.avatarId} size={props.size} />;
    return (
        <Avatar
            imageUrl={props.imageUrl}
            initials={props.name.slice(0, 1).toUpperCase()}
            size={props.size === 40 ? "lg" : "md"}
            type="agent"
        />
    );
}

function ChipRow(props: {
    label: string;
    hint?: string;
    choices: readonly KissopenAgentBotSettingsChoice[];
    selected: string | null;
    unset: string;
    onChange: (id: string | null) => void;
}) {
    return (
        <div className="kissopen-bot-settings__field">
            <span className="kissopen-bot-settings__label">{props.label}</span>
            <div className="kissopen-bot-settings__chips" role="radiogroup" aria-label={props.label}>
                <button
                    aria-checked={props.selected === null}
                    className="kissopen-bot-settings__chip"
                    onClick={() => props.onChange(null)}
                    role="radio"
                    type="button"
                >
                    {props.unset}
                </button>
                {props.choices.map((choice) => (
                    <button
                        aria-checked={props.selected === choice.id}
                        className="kissopen-bot-settings__chip"
                        key={choice.id}
                        onClick={() => props.onChange(choice.id)}
                        role="radio"
                        type="button"
                    >
                        {choice.label}
                    </button>
                ))}
            </div>
            {props.hint ? <span className="kissopen-bot-settings__quiet">{props.hint}</span> : null}
        </div>
    );
}
