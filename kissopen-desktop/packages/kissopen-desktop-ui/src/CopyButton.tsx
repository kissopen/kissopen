import { useRef, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";

export interface CopyButtonProps {
    readonly className?: string;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
    /** What the button offers to copy, for example "Copy command". */
    readonly label: string;
    readonly style?: CSSProperties;
    /** Exact text handed to the clipboard, read lazily when deriving it is expensive. */
    readonly text: string | (() => string);
}

/** How long the copied check stays before the button offers the copy again. */
const COPIED_MS = 1_600;

/**
 * CopyButton — the quiet clipboard action for a line whose full text is longer
 * than the row showing it. It confirms itself with a check for a moment, so a
 * reader knows the copy landed without a toast interrupting the surface.
 *
 * The surrounding row decides when the button is visible; the button only owns
 * its own copied state.
 */
export function CopyButton(props: CopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const copy = async () => {
        try {
            const text = typeof props.text === "function" ? props.text() : props.text;
            await navigator.clipboard.writeText(text);
            setCopied(true);
            if (copiedTimer.current !== undefined) clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => {
                copiedTimer.current = undefined;
                setCopied(false);
            }, COPIED_MS);
        } catch {
            // The browser owns clipboard permission; keep the action retryable.
        }
    };
    return (
        <button
            aria-label={copied ? "Copied" : props.label}
            className={["kissopen-copy-button", props.className].filter(Boolean).join(" ")}
            data-copied={copied ? "" : undefined}
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"] ?? "copy-button"}
            data-testid={props["data-testid"]}
            onClick={(event) => {
                // The line often sits inside a row that opens a detail surface.
                event.stopPropagation();
                void copy();
            }}
            style={props.style}
            type="button"
        >
            <Icon name={copied ? "check" : "copy"} size={14} />
        </button>
    );
}
