import type { ReactNode } from "react";
import {
    KissopenAgentBotSettingsDialog,
    type KissopenAgentBotSettingsDialogProps,
} from "../../src/KissopenAgentBotSettingsDialog";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-295";

/** The dialog is fixed to the window it is in, so a specimen gives it one. */
function frame(children: ReactNode, height = 900) {
    return (
        <div
            style={{
                background: "var(--groupped-background)",
                border: "1px solid var(--surface-pressed-overlay)",
                borderRadius: "8px",
                height: `${String(height)}px`,
                overflow: "hidden",
                position: "relative",
                transform: "translateZ(0)",
                width: "800px",
            }}
        >
            {children}
        </div>
    );
}

const noop = () => {};

const base: KissopenAgentBotSettingsDialogProps = {
    name: "Design Expert",
    username: "design_expert",
    builtIn: false,
    status: "ready",
    tab: "identity",
    onTabSelect: noop,
    nameDraft: "Design Expert",
    onNameChange: noop,
    description:
        "Creates images and short videos and edits visuals, from the first idea to the finished piece.",
    onDescriptionChange: noop,
    tones: [
        { id: "professional", label: "Professional" },
        { id: "friendly", label: "Friendly" },
        { id: "creative", label: "Creative" },
        { id: "concise", label: "Concise" },
        { id: "casual", label: "Casual" },
        { id: "expert", label: "Expert" },
    ],
    tone: "professional",
    onToneChange: noop,
    models: [
        { id: "codex/gpt-5.6-sol", label: "GPT-5.6 Sol" },
        { id: "claude/opus-5", label: "Claude Opus 5" },
        { id: "kissopen/qwen", label: "Qwen" },
    ],
    model: null,
    onModelChange: noop,
    avatarUploading: false,
    onAvatarPick: noop,
    copying: false,
    onCopy: noop,
    person: { name: "Steve", language: "English", note: "Lives in Berlin", background: "" },
    onPersonNameChange: noop,
    onPersonLanguageChange: noop,
    onPersonNoteChange: noop,
    onPersonBackgroundChange: noop,
    dirty: false,
    saving: false,
    onSave: noop,
    files: [
        { name: "SOUL.md", locked: false, dirty: false },
        { name: "IDENTITY.md", locked: false, dirty: false },
        { name: "AGENTS.md", locked: false, dirty: false },
        { name: "MEMORY.md", locked: false, dirty: true },
        { name: "USER.md", locked: false, dirty: false },
    ],
    fileSelected: "MEMORY.md",
    onFileSelect: noop,
    fileDraft: "# Memory\n\n- Prefers warm palettes.\n- Posters are A3.\n",
    onFileDraftChange: noop,
    fileLocked: false,
    fileDirty: true,
    fileSaving: false,
    fileUpdated: "Changed 3 minutes ago",
    onFileSave: noop,
    onHistoryOpen: noop,
    onHistoryClose: noop,
    onRevisionRestore: noop,
    onClose: noop,
};

export function KissopenAgentBotSettingsDialogPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="One assistant's identity, what it knows about the person, and the core files it reads every turn."
            title="KissopenAgentBotSettingsDialog"
        >
            <Specimen
                detail="640px · identity · style and model chips · copy"
                label="Identity"
                number="01"
                stage="app"
            >
                {frame(<KissopenAgentBotSettingsDialog {...base} />)}
                <DimensionRule label="modal large 640px" />
            </Specimen>
            <Specimen
                detail="edited · save enabled · save error"
                label="Edited"
                number="02"
                stage="app"
            >
                {frame(
                    <KissopenAgentBotSettingsDialog
                        {...base}
                        dirty
                        model="claude/opus-5"
                        saveError="This assistant was changed somewhere else in the meantime."
                    />,
                )}
            </Specimen>
            <Specimen
                detail="core files · edited memory · history open"
                label="Core files"
                number="03"
                stage="app"
            >
                {frame(
                    <KissopenAgentBotSettingsDialog
                        {...base}
                        history={{
                            status: "ready",
                            revisions: [
                                { id: "r2", label: "Today 10:42", detail: "By the assistant · 61 bytes" },
                                { id: "r1", label: "Yesterday 18:03", detail: "By you · 24 bytes" },
                            ],
                        }}
                        tab="files"
                    />,
                    1100,
                )}
            </Specimen>
            <Specimen
                detail="built-in · locked AGENTS.md"
                label="Built-in"
                number="04"
                stage="app"
            >
                {frame(
                    <KissopenAgentBotSettingsDialog
                        {...base}
                        builtIn
                        fileDirty={false}
                        fileDraft={"# Secretary\n\nYou are the user's persistent secretary…\n"}
                        fileLocked
                        fileSelected="AGENTS.md"
                        files={[
                            { name: "SOUL.md", locked: false, dirty: false },
                            { name: "IDENTITY.md", locked: false, dirty: false },
                            { name: "AGENTS.md", locked: true, dirty: false },
                            { name: "MEMORY.md", locked: false, dirty: false },
                            { name: "USER.md", locked: false, dirty: false },
                        ]}
                        name="小秘书"
                        tab="files"
                        username="secretary"
                    />,
                    1100,
                )}
            </Specimen>
            <Specimen detail="first read in flight" label="Loading" number="05" stage="app">
                {frame(<KissopenAgentBotSettingsDialog {...base} status="loading" />, 480)}
            </Specimen>
            <Specimen detail="agent too old" label="Error" number="06" stage="app">
                {frame(
                    <KissopenAgentBotSettingsDialog
                        {...base}
                        error="This computer's KISSOPEN Agent is too old for assistant settings. Update it first."
                        status="error"
                    />,
                    480,
                )}
            </Specimen>
        </ComponentPage>
    );
}
