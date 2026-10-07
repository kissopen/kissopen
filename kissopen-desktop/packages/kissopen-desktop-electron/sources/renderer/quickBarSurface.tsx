/*
The bar's own surface: the component, plus the three things it can ask for.

Kept apart from `renderer.tsx` because the bar and the application share only a
document. This one has no store, no router, no relay and no account — it has a
text field and a bridge with three calls on it, which is the whole of what a
window floating over somebody else's screen should be able to do.
*/
import { QuickBar } from "kissopen-desktop-ui";
import { useState } from "react";
import { t } from "kissopen-desktop-state";
import type { KissopenQuickBarBridge } from "../shared/desktopContract";

/** What the bar is doing, which is only ever one of four things. */
type Phase =
    | { readonly kind: "typing" }
    | { readonly kind: "sending" }
    | { readonly kind: "sent" }
    | { readonly kind: "failed"; readonly error: string };

export function QuickBarSurface(props: { readonly bridge: KissopenQuickBarBridge }) {
    const [phase, setPhase] = useState<Phase>({ kind: "typing" });

    const submit = (text: string) => {
        setPhase({ kind: "sending" });
        void props.bridge
            .quickBarSend(text)
            .then((answer) => {
                setPhase(
                    answer.ok
                        ? { kind: "sent" }
                        : { kind: "failed", error: answer.error ?? t("发送失败") },
                );
                /*
                 * Away on success, not on failure. A bar that vanished after a
                 * refusal would take the words with it and leave the person to
                 * retype them, having been told nothing.
                 */
                if (answer.ok) window.setTimeout(() => void props.bridge.quickBarClose(), 900);
            })
            .catch((error: unknown) => {
                setPhase({ kind: "failed", error: (error as Error).message });
            });
    };

    /*
     * The frame is what the window is sized to, and it is padded so the bar's
     * shadow has room to fall inside it rather than being clipped at the
     * window's edge. Measured rather than guessed, because the bar grows a line
     * at a time and a fixed window would leave a band of shadow under it.
     */
    const measure = (element: HTMLDivElement | null) => {
        if (!element) return;
        const report = () => props.bridge.quickBarHeight(element.offsetHeight);
        const observer = new ResizeObserver(report);
        observer.observe(element);
        report();
        return () => observer.disconnect();
    };

    return (
        <div className="kissopen-quick-bar-frame" ref={measure}>
            <QuickBar
                busy={phase.kind === "sending"}
                onClose={() => void props.bridge.quickBarClose()}
                onOpenConversation={() => void props.bridge.quickBarOpenConversation()}
                onSubmit={submit}
                sent={phase.kind === "sent"}
                {...(phase.kind === "failed" ? { error: phase.error } : {})}
            />
        </div>
    );
}
