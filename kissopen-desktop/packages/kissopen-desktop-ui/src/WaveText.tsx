import { type CSSProperties } from "react";

export interface WaveTextProps {
    readonly className?: string;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    /** The label. Plain text: every character gets its own place in the wave. */
    readonly text: string;
    /** One loop, in milliseconds. Defaults to the thinking mark's 2400. */
    readonly durationMs?: number;
    /**
     * Freezes the wave at one position, `0` to `1` across the loop, for a
     * fixture or a screenshot that has to photograph identically every time.
     */
    readonly phase?: number;
}

/**
 * C-306 WaveText — the thinking label's shimmer from the product owner's
 * "Juan Thinking" design: a light sweep that moves across the label one
 * character at a time.
 *
 * For character `i` of `n` the wave is `w = 0.5 − 0.5·cos(2π·(t − i/(n+2)))`
 * and the character is drawn at opacity `0.4 + 0.6·w`, in the surrounding
 * text's own colour, weight and spacing. Each character runs the same
 * CSS loop, started `i/(n+2)` of a lap later than the one before it.
 *
 * The characters are hidden from assistive technology and the label is given
 * once, whole, so it is read as a word rather than spelled. Reduced motion
 * shows the label at rest in full text colour.
 */
export function WaveText(props: WaveTextProps) {
    const characters = Array.from(props.text);
    const spread = characters.length + 2;
    const phase = props.phase === undefined ? undefined : ((props.phase % 1) + 1) % 1;
    return (
        <span
            className={["kissopen-wave-text", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"] ?? "wave-text"}
            data-paused={phase === undefined ? undefined : ""}
            data-testid={props["data-testid"]}
            style={
                {
                    ...props.style,
                    ...(props.durationMs === undefined
                        ? {}
                        : { "--kissopen-wave-duration": `${String(props.durationMs)}ms` }),
                    ...(phase === undefined ? {} : { "--kissopen-wave-phase": String(phase) }),
                } as CSSProperties
            }
        >
            <span className="kissopen-visually-hidden">{props.text}</span>
            {characters.map((character, index) => (
                <span
                    aria-hidden="true"
                    className="kissopen-wave-text__character"
                    // Characters repeat and never move, so position is their identity.
                    key={index}
                    style={{ "--kissopen-wave-lag": String(index / spread) } as CSSProperties}
                >
                    {character}
                </span>
            ))}
        </span>
    );
}
