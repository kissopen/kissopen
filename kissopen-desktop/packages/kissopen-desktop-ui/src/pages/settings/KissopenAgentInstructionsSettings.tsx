import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { FileEditor } from "../../FileEditor";
import { MarkdownDocument } from "../../MarkdownDocument";
import { Spinner } from "../../Spinner";
import { Tabs } from "../../Tabs";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export type KissopenAgentInstructionDocument = {
    /** Stable identity for switching between the peer global documents. */
    id: string;
    label: string;
    /** Where the machine keeps them, shown so it is clear what is being edited. */
    path: string;
    /** What this document controls. */
    description: string;
    placeholder: string;
    /** The draft: what the editor holds, which is not yet what the machine holds. */
    value: string;
    /** Unsaved edits exist. */
    dirty?: boolean;
    /** A write is in flight. */
    saving?: boolean;
    /** Set until the instructions have been read; the editor waits rather than showing empty. */
    loading?: boolean;
    /** Why they could not be read at all. */
    error?: string;
    /** Why the last write was refused — the machine's own reason. */
    saveError?: string;
    /** Why the local draft cannot currently be persisted. */
    saveDisabled?: boolean;
    saveDisabledReason?: string;
    /** Bytes the draft occupies, and the most the machine will keep. */
    bytes: number;
    maximumBytes: number;
    onValueChange: (value: string) => void;
    onSave: () => void;
    onRevert: () => void;
};

export type KissopenAgentInstructionsSettingsProps = {
    documents: readonly KissopenAgentInstructionDocument[];
};

/**
 * The Instructions category: the machine-wide agent instructions and security
 * policy, edited as peer Markdown documents.
 *
 * It is a file rather than a form, so it is edited as one — the same editor a
 * workspace file opens in, reading as Markdown and writing as text. The size
 * limit is the machine's own: it is stated here as room left, and a write past
 * it is refused by the machine in its own words rather than by a Save button
 * that has quietly stopped working.
 */
export function KissopenAgentInstructionsSettings(props: KissopenAgentInstructionsSettingsProps) {
    const [activeId, setActiveId] = useState(props.documents[0]?.id ?? "");
    const active =
        props.documents.find((document) => document.id === activeId) ?? props.documents[0];
    if (!active) return null;
    const oversize = active.bytes > active.maximumBytes;
    return (
        <KissopenAgentSettingsSection
            description={active.description}
            rows="cards"
            title={t("Global files")}
        >
            <Tabs
                activeId={active.id}
                onSelect={setActiveId}
                size="small"
                tabs={props.documents.map(({ id, label }) => ({ id, label }))}
            />
            {active.error ? (
                <Banner tone="danger" title={t("{label} unavailable", { label: active.label })}>
                    {active.error}
                </Banner>
            ) : active.loading ? (
                <Box className="kissopen-agent-settings__pending">
                    <Spinner size={16} />
                    <span>{`Reading ${active.label}…`}</span>
                </Box>
            ) : (
                <Box className="kissopen-agent-settings__editor">
                    <FileEditor
                        banner={
                            active.saveError ? (
                                <Banner tone="danger" title={t("Not saved")}>
                                    {active.saveError}
                                </Banner>
                            ) : oversize ? (
                                <Banner tone="warning" title={t("Too long to keep")}>
                                    {t(
                                        "{label} is {bytesLabel}, and this machine keeps at most {bytesLabel2}.",
                                        {
                                            label: active.label,
                                            bytesLabel: bytesLabel(active.bytes),
                                            bytesLabel2: bytesLabel(active.maximumBytes),
                                        },
                                    )}
                                </Banner>
                            ) : undefined
                        }
                        dirty={active.dirty}
                        initialFace={active.value.trim().length > 0 ? "rendered" : "source"}
                        key={active.id}
                        onRevert={active.onRevert}
                        onSave={active.onSave}
                        onValueChange={active.onValueChange}
                        path={active.path}
                        placeholder={active.placeholder}
                        rendered={<MarkdownDocument text={active.value} />}
                        saving={active.saving}
                        saveDisabled={active.saveDisabled}
                        status={
                            active.saveDisabledReason ??
                            `${bytesLabel(active.bytes)} of ${bytesLabel(active.maximumBytes)}`
                        }
                        value={active.value}
                    />
                </Box>
            )}
        </KissopenAgentSettingsSection>
    );
}

function bytesLabel(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
