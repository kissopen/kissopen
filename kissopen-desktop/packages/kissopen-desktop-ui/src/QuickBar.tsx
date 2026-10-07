import { t } from "kissopen-desktop-state";
import { useState, type CSSProperties, type KeyboardEvent, type Ref } from "react";
import { Icon } from "./Icon";
import { KissopenMark } from "./KissopenMark";
import { Spinner } from "./Spinner";

/**
 * One line standing over whatever the reader was looking at.
 *
 * It is not a conversation and must not grow into one: no transcript, no tool
 * cards, no history. Somebody summoned it because they had a sentence, and
 * what it owes them is somewhere to put that sentence and an honest word about
 * whether it arrived. Reading the answer happens in the window, which is one
 * click away in the line below.
 *
 * The text is local state because it belongs to this bar and dies with it —
 * a draft nobody else can see, in a surface that closes when it loses focus.
 */
export interface QuickBarProps {
    /** True while the sentence is in flight, which is the only busy state. */
    readonly busy?: boolean;
    readonly className?: string;
    readonly "data-testid"?: string;
    /** What went wrong, in words the reader can act on. */
    readonly error?: string;
    /** Set once something has arrived, which is what offers the way into it. */
    readonly sent?: boolean;
    /** Dismisses the bar without sending, on Escape or the close control. */
    readonly onClose: () => void;
    /** Opens the window on the conversation this went to. */
    readonly onOpenConversation: () => void;
    /** Sends what was typed. The bar keeps the text until this resolves. */
    readonly onSubmit: (text: string) => void;
    /** Where this is going, named so nobody wonders which machine answered. */
    readonly destination?: string;
    /** The bar's own element, for a caller that has to measure it. */
    readonly ref?: Ref<HTMLDivElement>;
    readonly style?: CSSProperties;
}

export function QuickBar(props: QuickBarProps) {
    const [text, setText] = useState("");
    const busy = props.busy === true;
    const ready = text.trim().length > 0 && !busy;

    const submit = () => {
        if (!ready) return;
        props.onSubmit(text.trim());
    };

    const key = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            props.onClose();
            return;
        }
        // Enter sends; Shift+Enter is how a second line is asked for, which is
        // the arrangement every composer in this product already uses.
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };

    return (
        <div
            className={`kissopen-quick-bar${props.className ? ` ${props.className}` : ""}`}
            data-testid={props["data-testid"] ?? "quick-bar"}
            ref={props.ref}
            style={props.style}
        >
            <div className="kissopen-quick-bar-row">
                {/* The mark alone: the bar is small, and the wordmark beside a
                    text field competes with the one place a reader is meant to
                    look. */}
                <KissopenMark className="kissopen-quick-bar-mark" size={30} />
                <textarea
                    id="kissopen-quick-bar-input"
                    aria-label={t("Ask KissOpen…")}
                    autoFocus
                    className="kissopen-quick-bar-input"
                    disabled={busy}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={key}
                    placeholder={t("What can I help you with today?")}
                    rows={1}
                    spellCheck={false}
                    value={text}
                />
                {busy ? (
                    <Spinner />
                ) : (
                    <button
                        aria-label={t("Send")}
                        className="kissopen-quick-bar-send"
                        disabled={!ready}
                        onClick={submit}
                        type="button"
                    >
                        <Icon name="send" size={16} />
                    </button>
                )}
            </div>
            <div className="kissopen-quick-bar-foot">
                <span className="kissopen-quick-bar-note">
                    {props.error ??
                        (props.sent
                            ? t("Sent.")
                            : (props.destination ?? t("Goes to your cloud workspace")))}
                </span>
                {props.sent && !props.error ? (
                    <button
                        className="kissopen-quick-bar-link"
                        onClick={props.onOpenConversation}
                        type="button"
                    >
                        {t("Open the conversation")}
                    </button>
                ) : undefined}
            </div>
        </div>
    );
}
