import type { ReactNode } from "react";
import { KissopenAgentProjectCloneDialog } from "../../src/KissopenAgentProjectCloneDialog";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-256";

/** Gives each fixed overlay a desktop-sized, clipping-safe specimen window. */
function frame(children: ReactNode) {
    return (
        <div
            style={{
                background: "var(--groupped-background)",
                border: "1px solid var(--surface-pressed-overlay)",
                borderRadius: "8px",
                height: "420px",
                overflow: "hidden",
                position: "relative",
                transform: "translateZ(0)",
                width: "760px",
            }}
        >
            {children}
        </div>
    );
}

const handlers = {
    onClose: () => undefined,
    onRepositoryChange: () => undefined,
    onSubmit: () => undefined,
};

export function KissopenAgentProjectCloneDialogPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="Cloning a GitHub repository onto one KISSOPEN Agent: paste a GitHub URL or write owner/repository, then let that KISSOPEN Agent create the checkout."
            title="KissopenAgentProjectCloneDialog"
        >
            <Specimen
                detail="480px · blank GitHub repository · Clone project disabled"
                label="Default"
                number="01"
                stage="app"
            >
                {frame(<KissopenAgentProjectCloneDialog {...handlers} repository="" />)}
            </Specimen>

            <Specimen
                detail="480px · request in flight · controls inert"
                label="Cloning"
                number="02"
                stage="app"
            >
                {frame(
                    <KissopenAgentProjectCloneDialog
                        {...handlers}
                        repository="anthropics/claude-code"
                        submitting
                    />,
                )}
            </Specimen>

            <Specimen
                detail="480px · clone error remains beside the retained repository"
                label="Error"
                number="03"
                stage="app"
            >
                {frame(
                    <KissopenAgentProjectCloneDialog
                        {...handlers}
                        error="GitHub could not find a repository at that address."
                        repository="octo-org/missing-project"
                    />,
                )}
            </Specimen>

            <Specimen
                detail="480px · KISSOPEN Agent offline · clear reason shown and submission unavailable"
                label="Unavailable"
                number="04"
                stage="app"
            >
                {frame(
                    <KissopenAgentProjectCloneDialog
                        {...handlers}
                        repository="owner/project"
                        submitDisabledReason="This KISSOPEN Agent is reconnecting. Try again when it is online."
                    />,
                )}
            </Specimen>
        </ComponentPage>
    );
}
