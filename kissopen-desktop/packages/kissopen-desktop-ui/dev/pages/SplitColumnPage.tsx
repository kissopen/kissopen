import { type ReactNode } from "react";
import { SplitColumn } from "../../src/SplitColumn";
import { EmptyState } from "../../src/EmptyState";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-163";
function Region(props: { label: string }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "1 1 auto",
                minHeight: 0,
                color: "var(--text-secondary)",
                background: "var(--groupped-background)",
                fontFamily: "var(--kissopen-font-ui)",
                fontSize: "13px",
            }}
        >
            {props.label}
        </div>
    );
}
function Stage(props: { children: ReactNode; height: number }) {
    return (
        <div
            style={{
                display: "flex",
                width: "340px",
                height: `${props.height}px`,
                background: "var(--surface)",
                border: "1px solid var(--divider)",
            }}
        >
            {props.children}
        </div>
    );
}
export function SplitColumnPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Split column"
            summary="Two stacked regions separated by a draggable horizontal divider. The lower region owns the boundary height; the upper region absorbs the rest. Drag the 8px lane, or focus it and use Arrow/Home/End."
            contract="Props only"
        >
            <section aria-label="Split column specimens">
                <Specimen
                    number="163.1"
                    label="default boundary"
                    detail="340 × 480 column, 240px lower region"
                    stage="chrome"
                >
                    <Stage height={480}>
                        <SplitColumn
                            bottom={<Region label="Lower region" />}
                            defaultBottomHeight={240}
                            resizeLabel="Resize lower region"
                            top={<Region label="Upper region" />}
                        />
                    </Stage>
                </Specimen>
                <Specimen
                    number="163.2"
                    label="empty lower region"
                    detail="the lower region carries its own empty state"
                    stage="chrome"
                >
                    <Stage height={480}>
                        <SplitColumn
                            bottom={
                                <EmptyState
                                    action={{
                                        label: "Start terminal",
                                        icon: "plus",
                                        onClick: () => {},
                                    }}
                                    description="Start a terminal to work beside the conversation."
                                    icon="terminal"
                                    size="panel"
                                    title="No terminal"
                                />
                            }
                            defaultBottomHeight={240}
                            resizeLabel="Resize lower region"
                            top={<Region label="Upper region" />}
                        />
                    </Stage>
                </Specimen>
                <Specimen
                    number="163.3"
                    label="clamped to minimums"
                    detail="a short column keeps both minimums, 100px each"
                    stage="chrome"
                >
                    <Stage height={260}>
                        <SplitColumn
                            bottom={<Region label="Lower region" />}
                            defaultBottomHeight={400}
                            minBottomHeight={100}
                            minTopHeight={100}
                            resizeLabel="Resize lower region"
                            top={<Region label="Upper region" />}
                        />
                    </Stage>
                </Specimen>
            </section>
        </ComponentPage>
    );
}
