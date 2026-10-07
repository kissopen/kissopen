import { Component } from "react";
import { BrowserAgentPointer, type BrowserPointerActivity } from "../../src/BrowserAgentPointer";
import {
    BrowserPanel,
    type BrowserContentProps,
    type BrowserContentRenderer,
    type BrowserFailure,
} from "../../src/BrowserPanel";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-161";

function BrowserPreview(_props: BrowserContentProps) {
    return (
        <div style={preview}>
            <div style={previewMark}>H</div>
            <div style={previewTitle}>Kissopen Browser</div>
            <div style={previewCopy}>
                A real Chromium guest occupies this region in the Electron desktop app.
            </div>
        </div>
    );
}

/**
 * A guest that fails its first load, the way Electron leaves the region blank
 * when a navigation never commits. The failure is reported once, from the ref
 * callback, so the specimen shows the panel's own error page.
 */
function browserFailurePreview(failure: BrowserFailure): BrowserContentRenderer {
    let reported = false;
    return function BrowserFailedPreview(props: BrowserContentProps) {
        return (
            <div
                ref={() => {
                    if (reported) return;
                    reported = true;
                    props.browserFailed(failure);
                }}
                style={preview}
            />
        );
    };
}

const unreachablePreview = browserFailurePreview({
    code: -105,
    description: "ERR_NAME_NOT_RESOLVED",
    url: "https://exmaple.invalid/dashboard",
});

const httpErrorPreview = browserFailurePreview({
    description: "Bad Request",
    status: 400,
    url: "http://localhost:3005/api/session",
});

class BrowserAutomationPreview extends Component<BrowserContentProps> {
    componentDidMount() {
        this.props.browserAutomationChanged?.("active");
        this.props.browserControllerReady({
            browserBack() {},
            browserForward() {},
            browserLoad() {},
            browserReload() {},
            browserStop() {},
        });
    }
    render() {
        return (
            <div style={preview}>
                <div style={previewTitle}>Your visible page</div>
                <div style={previewCopy}>
                    Interact with the page directly. Send an instruction to let AI continue.
                </div>
            </div>
        );
    }
}

export function BrowserPanelPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Desktop browser chrome hosting an isolated Chromium page renderer."
            title="Browser panel"
        >
            <Specimen
                detail="active tab · secure address · host-supplied browser content"
                label="Browsing"
                number="01"
                stage="app"
            >
                <div style={frame}>
                    <BrowserPanel
                        active
                        initialUrl="https://api.firstcache.cc/downloads/"
                        renderContent={BrowserPreview}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="no content renderer connected · unavailable host"
                label="Unavailable host"
                number="02"
                stage="app"
            >
                <div style={frame}>
                    <BrowserPanel active initialUrl="about:blank" />
                </div>
            </Specimen>
            <Specimen
                detail="network failure · named host · retry from the error page or the toolbar"
                label="Site unreachable"
                number="03"
                stage="app"
            >
                <div style={frame}>
                    <BrowserPanel
                        active
                        initialUrl="https://exmaple.invalid/dashboard"
                        renderContent={unreachablePreview}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="committed 4xx response with an empty body · raw status kept visible"
                label="HTTP error"
                number="04"
                stage="app"
            >
                <div style={frame}>
                    <BrowserPanel
                        active
                        initialUrl="http://localhost:3005/api/session"
                        renderContent={httpErrorPreview}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="known KISSOPEN Agent offline · retained guest stays mounted · navigation and retry are unavailable"
                label="KISSOPEN Agent offline"
                number="05"
                stage="app"
            >
                <div style={frame}>
                    <BrowserPanel
                        active
                        initialUrl="https://api.firstcache.cc/downloads/"
                        renderContent={BrowserPreview}
                        unavailable="KISSOPEN Agent is offline. Showing the last loaded page."
                    />
                </div>
            </Specimen>
            <Specimen
                label="Shared browser control"
                number="06"
                stage="app"
                detail="direct page interaction · no control overlay · continue with an instruction"
            >
                <div style={frame}>
                    <BrowserPanel
                        active
                        initialUrl="https://example.com"
                        renderContent={(props) => <BrowserAutomationPreview {...props} />}
                    />
                </div>
            </Specimen>
            {(["click", "fill", "scroll"] as const).map((action, index) => (
                <Specimen
                    key={action}
                    label={`AI pointer · ${action}`}
                    number={`0${index + 7}`}
                    stage="app"
                    detail="real guest coordinates · no input interception · animation frozen for measurement"
                >
                    <div
                        style={{
                            ...preview,
                            flex: "none",
                            position: "relative",
                            width: "760px",
                            height: "240px",
                        }}
                    >
                        <div style={previewTitle}>Your visible page</div>
                        <div style={previewCopy}>
                            The AI pointer marks the control being operated.
                        </div>
                        <BrowserAgentPointer
                            animated={false}
                            activity={{
                                operationId: action,
                                action,
                                phase: "start",
                                x: 0.55,
                                y: 0.55,
                            }}
                        />
                    </div>
                </Specimen>
            ))}
            <Specimen
                label="AI pointer · ended near edge"
                number="10"
                stage="app"
                detail="label remains inside the guest · pointer stays visible between AI actions"
            >
                <div
                    style={{
                        ...preview,
                        flex: "none",
                        position: "relative",
                        width: "760px",
                        height: "240px",
                    }}
                >
                    <BrowserAgentPointer
                        animated={false}
                        activity={
                            {
                                operationId: "end",
                                action: "click",
                                phase: "end",
                                x: 0.97,
                                y: 0.92,
                            } satisfies BrowserPointerActivity
                        }
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}

const frame = {
    display: "flex",
    flexDirection: "column" as const,
    height: "520px",
    width: "760px",
};

const preview = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    flexDirection: "column" as const,
    gap: "12px",
    color: "var(--text)",
    background: "var(--groupped-background)",
};

const previewMark = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "52px",
    height: "52px",
    color: "var(--button-primary-tint)",
    fontSize: "24px",
    fontWeight: 700,
    background: "var(--button-primary-background)",
    borderRadius: "14px",
};

const previewTitle = {
    fontSize: "20px",
    fontWeight: 650,
};

const previewCopy = {
    maxWidth: "360px",
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: "20px",
    textAlign: "center" as const,
};
