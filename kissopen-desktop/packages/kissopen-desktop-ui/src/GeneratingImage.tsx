import { useLayoutEffect, useRef, type CSSProperties } from "react";

/**
 * How far along a picture is, from how long it has been coming.
 *
 * Generation reports nothing while it runs, so the number is an estimate: it
 * climbs quickly at first and slows as it nears the top, the way a wait feels,
 * and never reaches the end on its own — only the finished picture does that.
 * The curve is tuned to the half minute a picture usually takes.
 */
export function imageGenerationProgress(elapsedMs: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
    return 0.96 * (1 - Math.exp(-elapsedMs / 22_000));
}

export type GeneratingImageProps = {
    /** How far along, 0–1. Drawn as how much of the grid has filled in. */
    progress: number;
    /** The badge in the corner, such as "76%". Absent draws no badge. */
    label?: string;
    /** Width and height of the region, in CSS pixels. */
    width: number;
    height: number;
    /** Freeze the animation on one frame (blueprint, tests). */
    still?: boolean;
    style?: CSSProperties;
};

/** Dots across the shorter side. */
const COLUMNS = 40;
/** Frame period for the field animation; nothing here needs 60 frames a second. */
const FRAME_MS = 1000 / 24;

/**
 * A picture being generated, drawn as the picture's own idea of itself: a
 * halftone grid whose dots swell where the image will be dense and fade toward
 * the edges, breathing while nothing has arrived yet. As the estimate climbs,
 * more of the grid fills in, and the badge in the corner says how far.
 *
 * The dots are drawn on a canvas because a thousand and more of them redrawn
 * two dozen times a second is a picture, not a document. The colour is read
 * from the element's own `color`, so the grid follows the theme like text.
 */
export function GeneratingImage(props: GeneratingImageProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const progressRef = useRef(props.progress);
    progressRef.current = props.progress;

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        const scale = window.devicePixelRatio || 1;
        canvas.width = Math.round(props.width * scale);
        canvas.height = Math.round(props.height * scale);
        const color = getComputedStyle(canvas).color;
        const started = performance.now();
        let frame = 0;
        let lastDrawn = -Infinity;

        const draw = (now: number) => {
            frame = props.still ? 0 : requestAnimationFrame(draw);
            if (now - lastDrawn < FRAME_MS) return;
            lastDrawn = now;
            drawField(context, {
                color,
                height: canvas.height,
                progress: progressRef.current,
                time: props.still ? 0 : (now - started) / 1000,
                width: canvas.width,
            });
        };
        draw(performance.now());
        return () => {
            if (frame) cancelAnimationFrame(frame);
        };
    }, [props.width, props.height, props.still]);

    return (
        <div
            className="kissopen-generating-image"
            data-kissopen-desktop-ui="generating-image"
            style={{ ...props.style, width: `${props.width}px`, height: `${props.height}px` }}
        >
            <canvas
                className="kissopen-generating-image__field"
                data-kissopen-desktop-ui="generating-image-field"
                ref={canvasRef}
                style={{ width: `${props.width}px`, height: `${props.height}px` }}
            />
            {props.label ? (
                <span
                    className="kissopen-generating-image__badge"
                    data-kissopen-desktop-ui="generating-image-badge"
                >
                    {props.label}
                </span>
            ) : null}
        </div>
    );
}

/**
 * One frame of the field.
 *
 * Three soft blobs drift across the grid on slow, unequal orbits, so the dense
 * region wanders rather than pulses; progress lifts the whole field, so the
 * grid fills from the middle outward as the estimate climbs. Each dot's radius
 * is the field there, and the field is also its opacity, which is what makes
 * the edge fade instead of stopping.
 */
function drawField(
    context: CanvasRenderingContext2D,
    frame: {
        readonly color: string;
        readonly height: number;
        readonly progress: number;
        readonly time: number;
        readonly width: number;
    },
) {
    const { width, height, time } = frame;
    const cell = Math.min(width, height) / COLUMNS;
    const columns = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const progress = Math.max(0, Math.min(1, frame.progress));
    const blobs = [
        { x: 0.55 + 0.22 * Math.sin(time * 0.37), y: 0.4 + 0.2 * Math.cos(time * 0.29), r: 0.42 },
        { x: 0.35 + 0.25 * Math.cos(time * 0.23), y: 0.6 + 0.22 * Math.sin(time * 0.41), r: 0.34 },
        {
            x: 0.6 + 0.3 * Math.sin(time * 0.19 + 1.7),
            y: 0.55 + 0.28 * Math.cos(time * 0.17 + 0.6),
            r: 0.28,
        },
    ];
    context.clearRect(0, 0, width, height);
    context.fillStyle = frame.color;
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const x = (column + 0.5) / columns;
            const y = (row + 0.5) / rows;
            let field = 0;
            for (const blob of blobs) {
                const dx = (x - blob.x) / blob.r;
                const dy = (y - blob.y) / blob.r;
                field += Math.exp(-(dx * dx + dy * dy) * 1.6);
            }
            // Progress floods the grid from its centre: a dot near the middle fills
            // first, the corners last, and a finished estimate leaves few gaps.
            const centre = 1 - Math.min(1, Math.hypot(x - 0.5, y - 0.5) / 0.75);
            const value = Math.min(1, 0.12 + field * 0.55 + progress * (0.25 + 0.6 * centre));
            if (value < 0.16) continue;
            // Light on purpose: a placeholder that waits beside the conversation, not a dark
            // mass. The densest dot stays about half as strong as text and never touches
            // its neighbours, so the field keeps reading as dots.
            context.globalAlpha = 0.12 + value * 0.38;
            context.beginPath();
            context.arc(
                (column + 0.5) * cell,
                (row + 0.5) * cell,
                cell * 0.36 * value,
                0,
                Math.PI * 2,
            );
            context.fill();
        }
    }
    context.globalAlpha = 1;
}
