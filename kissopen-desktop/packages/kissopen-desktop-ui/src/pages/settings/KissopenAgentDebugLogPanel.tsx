import { t } from "kissopen-desktop-state";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CopyButton } from "../../CopyButton";
import { ScrollArea } from "../../Scrollbar";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface KissopenAgentDebugLogPanelEntry {
    readonly detail?: string;
    readonly id: number;
    readonly level: "info" | "warning" | "error";
    readonly message: string;
    readonly occurredAt: number;
    readonly source: "catalog" | "connection" | "health" | "mutation" | "sse" | "sync";
}

export interface KissopenAgentDebugLogPanelProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly discardedEntries: number;
    readonly entries: readonly KissopenAgentDebugLogPanelEntry[];
    readonly style?: CSSProperties;
}

function entryText(entry: KissopenAgentDebugLogPanelEntry): string {
    const heading = `${new Date(entry.occurredAt).toISOString()} [${entry.level.toUpperCase()}] [${entry.source.toUpperCase()}] ${entry.message}`;
    if (entry.detail === undefined) return heading;
    return `${heading}\n${entry.detail
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")}`;
}

function logText(props: KissopenAgentDebugLogPanelProps): string {
    const entries = props.entries.map(entryText);
    if (props.discardedEntries > 0) {
        entries.unshift(
            t("… {toLocaleString} earlier {entries} discarded from the retained buffer", {
                toLocaleString: props.discardedEntries.toLocaleString("en-US"),
                entries: props.discardedEntries === 1 ? "entry" : "entries",
            }),
        );
    }
    return entries.join("\n\n");
}

const ESTIMATED_ENTRY_HEIGHT = 68;
const ENTRY_GAP = 17;
const CONTENT_INSET = 12;
const SCROLLPORT_HEIGHT = 320;

function discardedText(count: number): string {
    return t("… {toLocaleString} earlier {entries} discarded from the retained buffer", {
        toLocaleString: count.toLocaleString("en-US"),
        entries: count === 1 ? "entry" : "entries",
    });
}

/** Live, copyable connection and state diagnostics for one Kissopen Agent. */
export function KissopenAgentDebugLogPanel(props: KissopenAgentDebugLogPanelProps) {
    const scrollport = useRef<HTMLDivElement>(null);
    const following = useRef(true);
    const discardedOffset = props.discardedEntries > 0 ? 1 : 0;
    const itemCount = props.entries.length + discardedOffset;
    const lastEntryId = props.entries.at(-1)?.id;
    const itemKey = (index: number): number | string =>
        index < discardedOffset
            ? "discarded"
            : (props.entries[index - discardedOffset]?.id ?? index);
    // TanStack Virtual deliberately owns mutable measurement functions. This
    // leaf stays outside compiler memoization while its retained entries keep
    // their stable ids and DOM identity.
    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
        anchorTo: "end",
        count: itemCount,
        directDomUpdates: true,
        directDomUpdatesMode: "transform",
        estimateSize: () => ESTIMATED_ENTRY_HEIGHT,
        followOnAppend: true,
        gap: ENTRY_GAP,
        getItemKey: itemKey,
        getScrollElement: () => scrollport.current,
        initialOffset: () =>
            CONTENT_INSET * 2 +
            itemCount * ESTIMATED_ENTRY_HEIGHT +
            Math.max(0, itemCount - 1) * ENTRY_GAP,
        initialRect: { width: 0, height: SCROLLPORT_HEIGHT },
        overscan: 4,
        paddingEnd: CONTENT_INSET,
        paddingStart: CONTENT_INSET,
        scrollEndThreshold: ENTRY_GAP * 2,
        useFlushSync: false,
    });
    // eslint-disable-next-line kissopen-react/no-layout-effect -- a full retained buffer appends without changing its item count; the virtual scroll integration must follow that new keyed row before paint only while the reader remains at the end
    useLayoutEffect(() => {
        if (following.current) virtualizer.scrollToEnd();
    }, [lastEntryId, virtualizer]);

    return (
        <KissopenAgentSettingsSection
            description={t(
                "Connection transitions, reconciliation, raw SSE events, health, and mutation failures from this KissOpen Agent.",
            )}
            rows="cards"
            title={t("State log")}
        >
            <section
                className={["kissopen-agent-debug-log", props.className].filter(Boolean).join(" ")}
                data-kissopen-desktop-ui="kissopen-agent-debug-log"
                data-testid={props["data-testid"]}
                style={props.style}
            >
                <header className="kissopen-agent-debug-log__header">
                    <span className="kissopen-agent-debug-log__title">{t("Live diagnostics")}</span>
                    <span className="kissopen-agent-debug-log__count">
                        {props.entries.length.toLocaleString("en-US")} retained
                    </span>
                    <CopyButton
                        data-kissopen-desktop-ui="kissopen-agent-debug-log-copy"
                        label={t("Copy debug log")}
                        text={() => logText(props)}
                    />
                </header>
                <ScrollArea
                    axes="both"
                    className="kissopen-agent-debug-log__scrollport"
                    data-kissopen-desktop-ui="kissopen-agent-debug-log-scrollport"
                    viewportClassName="kissopen-agent-debug-log__viewport"
                    viewportProps={{
                        "aria-label": "Live KissOpen Agent debug log",
                        "aria-live": "off",
                        onScroll: () => {
                            following.current = virtualizer.isAtEnd(ENTRY_GAP * 2);
                        },
                        role: "log",
                        tabIndex: 0,
                    }}
                    viewportRef={scrollport}
                >
                    <div
                        className="kissopen-agent-debug-log__content"
                        ref={virtualizer.containerRef}
                    >
                        {itemCount === 0 ? (
                            <code className="kissopen-agent-debug-log__empty">
                                {t("Waiting for internal state events…")}
                            </code>
                        ) : (
                            virtualizer.getVirtualItems().map((item) => {
                                const entry = props.entries[item.index - discardedOffset];
                                const text = entry
                                    ? entryText(entry)
                                    : discardedText(props.discardedEntries);
                                return (
                                    <pre
                                        className="kissopen-agent-debug-log__entry"
                                        data-index={item.index}
                                        key={item.key}
                                        ref={virtualizer.measureElement}
                                    >
                                        <code>{text}</code>
                                    </pre>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </section>
        </KissopenAgentSettingsSection>
    );
}
