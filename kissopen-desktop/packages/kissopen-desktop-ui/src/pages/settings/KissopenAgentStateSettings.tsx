import { t } from "kissopen-desktop-state";
import { Box } from "../../Box";
import { CopyButton } from "../../CopyButton";
import { ScrollArea } from "../../Scrollbar";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

/** One named store snapshot, already serialized by whoever owns it. */
export interface KissopenAgentStateDocument {
    /** What the snapshot is, in the words its owner uses. */
    readonly description: string;
    readonly id: string;
    readonly label: string;
    /** The snapshot as text. Pretty-printed JSON is what every caller sends. */
    readonly value: string;
}

export interface KissopenAgentStateSettingsProps {
    readonly documents: readonly KissopenAgentStateDocument[];
}

/**
 * Every live store snapshot this window can see, printed verbatim.
 *
 * It exists so a state question can be answered by reading rather than by
 * guessing from what the ordinary screens happen to render. Nothing here is
 * summarized, relabelled, or filtered: each document is one store's own
 * snapshot serialized by its owner, so what appears is exactly what the surfaces
 * are rendering from. Each one is copyable whole, because the useful thing to do
 * with it is paste it into a bug report.
 *
 * It updates the way every other surface does — through its stores — so a value
 * that changes while this page is open changes here too.
 */
export function KissopenAgentStateSettings(props: KissopenAgentStateSettingsProps) {
    return (
        <KissopenAgentSettingsSection
            description={t(
                "Every live store snapshot this window holds, exactly as its surfaces read it.",
            )}
            rows="cards"
            title={t("Raw state")}
        >
            {props.documents.map((document) => (
                <section
                    className="kissopen-agent-raw-state"
                    data-kissopen-desktop-ui="kissopen-agent-raw-state"
                    key={document.id}
                >
                    <header className="kissopen-agent-raw-state__header">
                        <span className="kissopen-agent-raw-state__title">{document.label}</span>
                        <span className="kissopen-agent-raw-state__detail">
                            {document.description}
                        </span>
                        <CopyButton
                            label={t("Copy {label} state", { label: document.label })}
                            text={document.value}
                        />
                    </header>
                    <ScrollArea
                        axes="both"
                        className="kissopen-agent-raw-state__scrollport"
                        viewportClassName="kissopen-agent-raw-state__viewport"
                        viewportProps={{
                            "aria-label": `${document.label} state`,
                            tabIndex: 0,
                        }}
                    >
                        <Box className="kissopen-agent-raw-state__content">
                            <pre className="kissopen-agent-raw-state__value">
                                <code>{document.value}</code>
                            </pre>
                        </Box>
                    </ScrollArea>
                </section>
            ))}
        </KissopenAgentSettingsSection>
    );
}
