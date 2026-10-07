import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type HTMLAttributes } from "react";
import { compactCount, changeCountLabel } from "./countText";
import { ScrollArea } from "./Scrollbar";
export type DiffLineKind = "add" | "del" | "context" | "meta";
export type DiffLine = {
    kind: DiffLineKind;
    number?: number;
    text: string;
};
export type DiffSnippetProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
    className?: string;
    file?: string;
    lines: DiffLine[];
    stats?: {
        added: number;
        removed: number;
    };
    style?: CSSProperties;
    /**
     * Soft-wraps long lines instead of scrolling them sideways. A diff read in a
     * narrow column — an inspector panel rather than a full-width page — has no
     * room to carry a scrollport per block, and a line the reader never sees is
     * worse than a line that takes two rows.
     */
    wrap?: boolean;
};
function gutterGlyph(kind: DiffLineKind) {
    if (kind === "add") return "+";
    if (kind === "del") return "−";
    return "";
}
export function DiffSnippet(props: DiffSnippetProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "file",
        "lines",
        "stats",
        "style",
        "wrap",
    ]);
    const numbered = () => local.lines.some((line) => line.number !== undefined);
    return (
        <div
            {...rest}
            className={["kissopen-diff-snippet", local.className].filter(Boolean).join(" ")}
            data-numbered={numbered() ? "" : undefined}
            data-kissopen-desktop-ui="diff-snippet"
            data-wrap={local.wrap ? "" : undefined}
            style={local.style}
        >
            {local.file !== undefined || local.stats !== undefined ? (
                <div
                    className="kissopen-diff-snippet__header"
                    data-kissopen-desktop-ui="diff-snippet-header"
                >
                    {local.file !== undefined ? (
                        <span
                            className="kissopen-diff-snippet__file"
                            data-kissopen-desktop-ui="diff-snippet-file"
                        >
                            {local.file}
                        </span>
                    ) : null}
                    {/* A side that changed nothing is left unsaid: "+0" is a
                        number the reader has to read before learning there was
                        nothing to learn, and a diff with neither side shows no
                        stats cluster at all. */}
                    {local.stats && (local.stats.added || local.stats.removed)
                        ? ((stats) => (
                              <span
                                  className="kissopen-diff-snippet__stats"
                                  data-kissopen-desktop-ui="diff-snippet-stats"
                              >
                                  {stats.added ? (
                                      <span
                                          aria-hidden="true"
                                          className="kissopen-diff-snippet__added"
                                          data-kissopen-desktop-ui="diff-snippet-added"
                                      >
                                          +{compactCount(stats.added)}
                                      </span>
                                  ) : null}
                                  {stats.removed ? (
                                      <span
                                          aria-hidden="true"
                                          className="kissopen-diff-snippet__removed"
                                          data-kissopen-desktop-ui="diff-snippet-removed"
                                      >
                                          &minus;{compactCount(stats.removed)}
                                      </span>
                                  ) : null}
                                  <span className="kissopen-visually-hidden">
                                      {changeCountLabel(stats.added ?? 0, stats.removed ?? 0)}
                                  </span>
                              </span>
                          ))(local.stats)
                        : null}
                </div>
            ) : null}
            <ScrollArea
                axes="horizontal"
                className="kissopen-diff-snippet__scroll"
                data-kissopen-desktop-ui="diff-snippet-scroll"
                viewportClassName="kissopen-diff-snippet__scroll-viewport"
            >
                <div
                    className="kissopen-diff-snippet__code"
                    data-kissopen-desktop-ui="diff-snippet-code"
                >
                    {local.lines.map((line, index) => (
                        <div
                            className="kissopen-diff-snippet__line"
                            key={`${line.kind}-${line.number ?? ""}-${index}`}
                            data-kind={line.kind}
                            data-kissopen-desktop-ui="diff-snippet-line"
                        >
                            {numbered() ? (
                                <span
                                    className="kissopen-diff-snippet__number"
                                    data-kissopen-desktop-ui="diff-snippet-number"
                                >
                                    {line.number}
                                </span>
                            ) : null}
                            <span
                                className="kissopen-diff-snippet__gutter"
                                data-kissopen-desktop-ui="diff-snippet-gutter"
                            >
                                {gutterGlyph(line.kind)}
                            </span>
                            <span
                                className="kissopen-diff-snippet__text"
                                data-kissopen-desktop-ui="diff-snippet-text"
                            >
                                {line.text}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
