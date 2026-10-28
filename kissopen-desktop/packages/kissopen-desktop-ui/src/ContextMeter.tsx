import { t } from "kissopen-desktop-state";
import { useId, useRef, useState, type CSSProperties } from "react";

export interface ContextMeterProps {
    readonly compaction?: {
        readonly modelId: string;
        readonly overridePercent?: number;
        readonly defaultPercent: number | null;
        readonly disabled?: boolean;
        readonly onChange: (percent: number | null) => Promise<void>;
    };
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    /** Tokens already spent in the window. */
    readonly usedTokens: number;
    /** The whole context window. */
    readonly totalTokens: number;
    /** Display name supplied by the model catalog, never inferred from an ID. */
    readonly modelName?: string;
    /** Makes the details directly inspectable in the component workbench. */
    readonly defaultOpen?: boolean;
    /**
     * Tokens at which the daemon compacts the conversation on its own. The notch sits here and
     * the colour turns as the fill approaches it. Without it no threshold is claimed.
     */
    readonly compactTokens?: number;
    /** True when the underlying count is estimated rather than reported. */
    readonly approximate?: boolean;
    /** False while the model window is known but no provider measurement exists yet. */
    readonly measured?: boolean;
}

/**
 * The bar takes its warning colour once the fill is within this share of the compaction point,
 * so it turns yellow while there is still room to finish a thought, and its error colour at the
 * point itself, when the next turn compacts.
 */
const WARNING_MARGIN = 0.2;
const contextMeterFractions = new WeakMap<HTMLElement, number>();

function contextMeterAnimate(node: HTMLElement | null, fraction: number): void {
    if (!node) return;

    const previousFraction = contextMeterFractions.get(node);
    contextMeterFractions.set(node, fraction);
    if (
        previousFraction === undefined ||
        previousFraction === fraction ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
        return;

    const track = node.querySelector<HTMLElement>(".kissopen-context-meter__track");
    if (!track) return;

    track.getAnimations().forEach((animation) => animation.cancel());
    if (fraction > previousFraction) {
        track.animate(
            [
                { transform: "scaleX(1) scaleY(1)" },
                { transform: "scaleX(1.025) scaleY(1.45)", offset: 0.32 },
                { transform: "scaleX(0.995) scaleY(0.92)", offset: 0.68 },
                { transform: "scaleX(1) scaleY(1)" },
            ],
            {
                duration: 360,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
        );
        const shine = track.querySelector<HTMLElement>(".kissopen-context-meter__shine");
        shine?.animate(
            [
                { opacity: 0, transform: "translateX(-160%)" },
                { opacity: 0.82, offset: 0.24 },
                { opacity: 0, transform: "translateX(260%)" },
            ],
            {
                duration: 520,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
        );
        return;
    }

    track.animate(
        [
            { transform: "scaleX(1) scaleY(1)" },
            { transform: "scaleX(0.92) scaleY(1.55)", offset: 0.24 },
            { transform: "scaleX(1.035) scaleY(0.88)", offset: 0.58 },
            { transform: "scaleX(0.99) scaleY(1.08)", offset: 0.8 },
            { transform: "scaleX(1) scaleY(1)" },
        ],
        {
            duration: 460,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
    );
}

function tokensFormat(tokens: number): string {
    if (tokens < 1000) return String(Math.max(0, Math.round(tokens)));
    const thousands = tokens / 1000;
    if (thousands < 1000) return `${thousands.toFixed(1).replace(/\.0$/, "")}K`;
    const millions = thousands / 1000;
    return `${millions.toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * ContextMeter — how much of the model's context window the conversation has
 * spent. Hover or focus previews the details; clicking pins the card until
 * dismissed. Counts, model and compaction point always come from product state.
 */
export function ContextMeter(props: ContextMeterProps) {
    const [open, setOpen] = useState<false | "preview" | "pinned">(
        props.defaultOpen ? "preview" : false,
    );
    const root = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const [draft, setDraft] = useState<{ modelId: string; percent: number }>();
    const [save, setSave] = useState<{
        modelId: string;
        status: "saving" | "error";
        message?: string;
    }>();
    const total = Math.max(0, props.totalTokens);
    const measured = props.measured !== false;
    const used = measured ? Math.max(0, Math.min(props.usedTokens, total)) : 0;
    const fraction = total === 0 ? 0 : used / total;
    const percent = Math.round(fraction * 100);
    const hasCompactPoint =
        props.compactTokens !== undefined && props.compactTokens > 0 && props.compactTokens < total;
    const compactFraction =
        props.compactTokens !== undefined && props.compactTokens > 0 && props.compactTokens < total
            ? props.compactTokens / total
            : 0;
    const editor = props.compaction;
    const draftPercent = editor && draft?.modelId === editor.modelId ? draft.percent : undefined;
    const editPercent = draftPercent ?? Math.round(compactFraction * 100);
    const saving = save?.status === "saving";
    const error =
        save?.modelId === editor?.modelId && save?.status === "error" ? save.message : undefined;
    const savePercent = (percent: number | null): void => {
        if (!editor || editor.disabled || saving) return;
        const modelId = editor.modelId;
        setSave({ modelId, status: "saving" });
        void editor.onChange(percent).then(
            () => {
                setDraft((current) => (current?.modelId === modelId ? undefined : current));
                setSave((current) => (current?.modelId === modelId ? undefined : current));
            },
            (reason: unknown) => {
                setDraft((current) => (current?.modelId === modelId ? undefined : current));
                setSave((current) =>
                    current?.modelId === modelId
                        ? {
                              modelId,
                              status: "error",
                              message:
                                  reason instanceof Error
                                      ? reason.message
                                      : t("Could not save compaction preferences."),
                          }
                        : current,
                );
            },
        );
    };
    const commitDraft = (): void => {
        if (draftPercent !== undefined) savePercent(draftPercent);
    };
    const tone =
        hasCompactPoint && fraction >= compactFraction
            ? "critical"
            : hasCompactPoint && fraction >= compactFraction * (1 - WARNING_MARGIN)
              ? "compact"
              : "ample";
    const compactNote =
        props.compactTokens === undefined
            ? ""
            : t(" · compacts at {tokens}", { tokens: tokensFormat(props.compactTokens) });
    return (
        <div
            className={["kissopen-context-meter", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="context-meter"
            data-testid={props["data-testid"]}
            data-tone={tone}
            data-open={open ? "" : undefined}
            ref={root}
            onMouseEnter={() => setOpen((current) => current || "preview")}
            onMouseLeave={() => setOpen((current) => (current === "preview" ? false : current))}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
            onKeyDown={(event) => {
                if (event.key !== "Escape" || !open) return;
                event.stopPropagation();
                setOpen(false);
                root.current
                    ?.querySelector<HTMLButtonElement>(".kissopen-context-meter__trigger")
                    ?.focus();
            }}
            style={props.style}
        >
            <button
                aria-label={
                    measured
                        ? t(
                              "{tokensFormat} of {tokensFormat2} context tokens used{approximate}{compactNote}",
                              {
                                  tokensFormat: tokensFormat(used),
                                  tokensFormat2: tokensFormat(total),
                                  approximate: props.approximate ? t(", approximate") : "",
                                  compactNote,
                              },
                          )
                        : t(
                              "Context measurement pending for a {tokensFormat} token window{compactNote}",
                              { tokensFormat: tokensFormat(total), compactNote },
                          )
                }
                aria-expanded={Boolean(open)}
                aria-controls={open ? panelId : undefined}
                aria-haspopup="dialog"
                className="kissopen-context-meter__trigger"
                onClick={() => setOpen((current) => (current === "pinned" ? false : "pinned"))}
                onFocus={() => setOpen((current) => current || "preview")}
                ref={(node) => contextMeterAnimate(node, fraction)}
                type="button"
            >
                <span aria-hidden="true" className="kissopen-context-meter__readout">
                    <span className="kissopen-context-meter__percent">
                        {measured ? `${props.approximate ? "~" : ""}${String(percent)}%` : "—"}
                    </span>
                    <span className="kissopen-context-meter__tokens">
                        {measured ? tokensFormat(used) : "—"}/{tokensFormat(total)}
                    </span>
                </span>
                <span
                    aria-hidden="true"
                    className="kissopen-context-meter__track"
                    data-kissopen-desktop-ui="context-meter-track"
                >
                    {/*
                     * The fill is a width, not a transform: the bar is one hairline
                     * tall and a scaled fill would smear its rounded end.
                     */}
                    <span
                        className="kissopen-context-meter__fill"
                        data-kissopen-desktop-ui="context-meter-fill"
                        style={{ width: `${String(fraction * 100)}%` }}
                    />
                    <span className="kissopen-context-meter__shine" />
                    {/*
                     * Where the daemon compacts, notched into the track itself, so
                     * the fill approaching it is legible before the colour changes
                     * rather than only after. The notch is centred on the point.
                     */}
                    {hasCompactPoint ? (
                        <span
                            className="kissopen-context-meter__threshold"
                            style={{ left: `calc(${String(compactFraction * 100)}% - 1.5px)` }}
                        />
                    ) : null}
                </span>
            </button>
            {open === "pinned" ? (
                <button
                    aria-label={t("Close context details")}
                    className="kissopen-context-meter__backdrop"
                    onClick={() => setOpen(false)}
                    tabIndex={-1}
                    type="button"
                />
            ) : null}
            {open ? (
                <div className="kissopen-context-meter__popover">
                    <div
                        aria-label={t("Context window")}
                        className="kissopen-context-meter__card"
                        data-kissopen-desktop-ui="context-meter-card"
                        id={panelId}
                        role="dialog"
                    >
                        <div className="kissopen-context-meter__heading">
                            <strong>{t("Context window")}</strong>
                            <strong className="kissopen-context-meter__accent">
                                {measured
                                    ? `${props.approximate ? "~" : ""}${String(percent)}%`
                                    : "—"}
                            </strong>
                        </div>
                        <dl className="kissopen-context-meter__stats">
                            <div className="kissopen-context-meter__row">
                                <dt>{t("Used")}</dt>
                                <dd>
                                    {measured
                                        ? `${props.approximate ? "~" : ""}${tokensFormat(used)}`
                                        : "—"}
                                </dd>
                            </div>
                            <div className="kissopen-context-meter__row">
                                <dt>{t("Remaining")}</dt>
                                <dd>
                                    {measured
                                        ? `${props.approximate ? "~" : ""}${tokensFormat(total - used)}`
                                        : "—"}
                                </dd>
                            </div>
                            <div className="kissopen-context-meter__row">
                                <dt>{t("Total")}</dt>
                                <dd>{tokensFormat(total)}</dd>
                            </div>
                        </dl>
                        <dl className="kissopen-context-meter__model">
                            <div className="kissopen-context-meter__row">
                                <dt>{t("Model")}</dt>
                                <dd title={props.modelName}>{props.modelName ?? "—"}</dd>
                            </div>
                        </dl>
                        <div className="kissopen-context-meter__compaction">
                            <div className="kissopen-context-meter__row">
                                <span>{t("Auto-compact at")}</span>
                                <strong className="kissopen-context-meter__accent">
                                    {hasCompactPoint
                                        ? `${String(editor ? editPercent : Math.round(compactFraction * 100))}%`
                                        : "—"}
                                </strong>
                            </div>
                            {hasCompactPoint && editor ? (
                                <input
                                    aria-label={t("Auto-compact at")}
                                    aria-valuetext={t("{percent}% of the context window", {
                                        percent: editPercent,
                                    })}
                                    className="kissopen-context-meter__slider"
                                    disabled={editor.disabled || saving}
                                    max={90}
                                    min={10}
                                    onFocus={() => setOpen("pinned")}
                                    onPointerDown={() => setOpen("pinned")}
                                    onBlur={commitDraft}
                                    onChange={(event) => {
                                        setDraft({
                                            modelId: editor.modelId,
                                            percent: Number(event.currentTarget.value),
                                        });
                                        setSave(undefined);
                                    }}
                                    onKeyUp={(event) => {
                                        if (
                                            [
                                                "ArrowLeft",
                                                "ArrowRight",
                                                "ArrowUp",
                                                "ArrowDown",
                                                "Home",
                                                "End",
                                                "PageUp",
                                                "PageDown",
                                            ].includes(event.key)
                                        )
                                            commitDraft();
                                    }}
                                    onPointerUp={commitDraft}
                                    onPointerCancel={() => setDraft(undefined)}
                                    step={1}
                                    style={
                                        {
                                            "--context-compact-fill": `${String(((editPercent - 10) / 80) * 100)}%`,
                                        } as CSSProperties
                                    }
                                    type="range"
                                    value={editPercent}
                                />
                            ) : hasCompactPoint ? (
                                <div
                                    aria-label={t("Auto-compact at")}
                                    aria-valuemax={total}
                                    aria-valuemin={0}
                                    aria-valuenow={props.compactTokens}
                                    className="kissopen-context-meter__compact-track"
                                    role="meter"
                                >
                                    <span style={{ width: `${String(compactFraction * 100)}%` }} />
                                </div>
                            ) : null}
                            {editor && hasCompactPoint ? (
                                <div className="kissopen-context-meter__preference">
                                    <span className="kissopen-context-meter__note" role="status">
                                        {saving
                                            ? t("Saving…")
                                            : draftPercent !== undefined
                                              ? t("Release to save")
                                              : editor.overridePercent !== undefined
                                                ? t("Model override")
                                                : editor.defaultPercent === null
                                                  ? t("Using model default")
                                                  : t("Following global ({percent}%)", {
                                                        percent: editor.defaultPercent,
                                                    })}
                                    </span>
                                    {editor.overridePercent === undefined ? null : (
                                        <button
                                            className="kissopen-context-meter__reset"
                                            disabled={editor.disabled || saving}
                                            onClick={() => savePercent(null)}
                                            type="button"
                                        >
                                            {t("Use default")}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <span className="kissopen-context-meter__note">
                                    {hasCompactPoint
                                        ? t("Compacts at {tokens} tokens", {
                                              tokens: tokensFormat(props.compactTokens!),
                                          })
                                        : t("Automatic compaction threshold unavailable")}
                                </span>
                            )}
                            {error ? (
                                <span className="kissopen-context-meter__error" role="alert">
                                    {error}
                                </span>
                            ) : null}
                        </div>
                        {!measured ? (
                            <span className="kissopen-context-meter__note">
                                {t("Waiting for the first context measurement")}
                            </span>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
