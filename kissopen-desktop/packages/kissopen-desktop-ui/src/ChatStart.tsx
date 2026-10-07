import { useState } from "react";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";

/*
A conversation that has not started yet: what it is for, and the box to say
the first thing in. Sending hands the text to the caller, which starts the
conversation wherever it lives and says whether it is on its way; the draft is
kept until it is, so a start that fails loses nothing. The draft and the wait
are the only state here.
*/

export type ChatStartProps = {
    readonly title: string;
    readonly description: string;
    readonly placeholder: string;
    /** Nothing can be started right now. */
    readonly disabled?: boolean;
    /** Starts the conversation with its first message; true once it is on its way. */
    readonly onStart: (text: string) => Promise<boolean>;
};

export function ChatStart(props: ChatStartProps) {
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const send = (): void => {
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true);
        void props
            .onStart(text)
            .then((started) => {
                if (started) setDraft("");
            })
            .finally(() => setSending(false));
    };
    return (
        <div className="kissopen-relay-new" data-kissopen-desktop-ui="chat-start">
            <EmptyState icon="chat" title={props.title} description={props.description} />
            <Composer
                disabled={props.disabled === true || sending}
                focusOnType
                onValueChange={setDraft}
                onSend={send}
                placeholder={props.placeholder}
                value={draft}
            />
        </div>
    );
}
