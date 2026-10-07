/*
 * Device-pixel renderer for cli-spinners' `dots2` Braille loop.
 *
 * A 14px loader is only 28 physical pixels tall on the Retina surface it is
 * designed for. Drawing each of its eight dots as an independently
 * antialiased CSS circle makes the weak edge pixels disappear at a different
 * rate as opacity changes, so dots with the same CSS dimensions appear to
 * change size. This renderer owns the final pixel grid instead: it chooses one
 * binary dot stamp for the canvas's actual physical height and copies that
 * exact stamp eight times at integer coordinates. At least one transparent
 * device pixel stays between every dot and the canvas edge, so a fractionally
 * positioned canvas cannot lend its antialiased clipping edge to a dot.
 *
 * Animation is equally singular. Every dot evaluates `dotOpacity` with the
 * same local time; the only difference is its 100ms phase. That reproduces the
 * existing 800ms waveform exactly — 60ms down, 40ms held dim, 60ms up — while
 * making it impossible for one dot to acquire a different transition program.
 * All mounted canvases in one window share one requestAnimationFrame clock.
 */

const BRAILLE_FRAME_COUNT = 8;
const BRAILLE_FRAME_MS = 100;
const BRAILLE_CYCLE_MS = BRAILLE_FRAME_COUNT * BRAILLE_FRAME_MS;
const BRAILLE_FADE_MS = 60;
const BRAILLE_DIM_OPACITY = 0.18;

/* DOM order is left column top-to-bottom, then right column top-to-bottom.
 * dots2 dims dot1, dot2, dot3, dot7, dot8, dot6, dot5, then dot4. */
const DOT_PHASES = [0, 1, 2, 3, 7, 6, 5, 4] as const;

type PixelPoint = readonly [x: number, y: number];
type PixelSpan = readonly [start: number, length: number];

interface BrailleRenderer {
    draw(now: number): void;
}

interface BrailleClock {
    readonly renderers: Set<BrailleRenderer>;
    request: number | undefined;
}

const clocks = new WeakMap<Window, BrailleClock>();

function modulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
}

/** The one opacity waveform every dot runs, sampled at its phase-local time. */
function dotOpacity(localTime: number): number {
    const time = modulo(localTime, BRAILLE_CYCLE_MS);
    if (time < BRAILLE_FADE_MS) {
        return 1 - (1 - BRAILLE_DIM_OPACITY) * (time / BRAILLE_FADE_MS);
    }
    if (time < BRAILLE_FRAME_MS) return BRAILLE_DIM_OPACITY;
    if (time < BRAILLE_FRAME_MS + BRAILLE_FADE_MS) {
        return (
            BRAILLE_DIM_OPACITY +
            (1 - BRAILLE_DIM_OPACITY) * ((time - BRAILLE_FRAME_MS) / BRAILLE_FADE_MS)
        );
    }
    return 1;
}

/** One hard-edged circular stamp, as horizontal one-device-pixel spans. */
function dotStamp(diameter: number): readonly PixelSpan[] {
    const center = (diameter - 1) / 2;
    const radius = diameter / 2;
    return Array.from({ length: diameter }, (_, y) => {
        let first = diameter;
        let last = -1;
        for (let x = 0; x < diameter; x += 1) {
            if (Math.hypot(x - center, y - center) > radius) continue;
            first = Math.min(first, x);
            last = x;
        }
        return [first, Math.max(0, last - first + 1)] as const;
    });
}

/**
 * Places four equal stamps with one guaranteed device pixel of top and bottom
 * padding. The remaining rows never alter the stamps:
 *
 * - first they widen the three internal gaps symmetrically;
 * - an unavoidable lone row goes into the middle gap.
 *
 * The first and last dots therefore remain mirror-aligned inside the box, and
 * every rounding sacrifice happens in whitespace.
 */
function rowOrigins(height: number, diameter: number): readonly number[] {
    const whitespace = Math.max(0, height - diameter * 4);
    const padding = whitespace >= 2 ? 1 : 0;
    const internalWhitespace = Math.max(0, whitespace - padding * 2);
    const baseGap = Math.min(diameter, Math.floor(internalWhitespace / 3));
    const remainder = internalWhitespace - baseGap * 3;
    const gapExtras =
        remainder === 0
            ? ([0, 0, 0] as const)
            : remainder === 1
              ? ([0, 1, 0] as const)
              : remainder === 2
                ? ([1, 0, 1] as const)
                : remainder === 3
                  ? ([1, 1, 1] as const)
                  : ([1, 2, 1] as const);
    const gaps = gapExtras.map((extra) => baseGap + extra);
    return [
        padding,
        padding + diameter + gaps[0]!,
        padding + diameter * 2 + gaps[0]! + gaps[1]!,
        padding + diameter * 3 + gaps[0]! + gaps[1]! + gaps[2]!,
    ];
}

/** Largest stamp that leaves hard one-pixel gaps and a transparent perimeter. */
function dotDiameter(width: number, height: number): number {
    let diameter = Math.min(width, height, Math.max(2, Math.floor(height / 7)));
    while (diameter > 1 && (width < diameter * 2 + 3 || height < diameter * 4 + 5)) {
        diameter -= 1;
    }
    return diameter;
}

/** Two columns with equal integer padding; an odd spare pixel widens the gap. */
function columnOrigins(width: number, diameter: number): readonly [number, number] {
    const whitespace = Math.max(0, width - diameter * 2);
    const baseGap = Math.min(diameter, whitespace);
    const remainder = whitespace - baseGap;
    const padding = Math.floor(remainder / 2);
    const gap = baseGap + modulo(remainder, 2);
    return [padding, padding + diameter + gap];
}

function dotOrigins(width: number, height: number, diameter: number): readonly PixelPoint[] {
    const rows = rowOrigins(height, diameter);
    const columns = columnOrigins(width, diameter);
    return [
        ...rows.map((y) => [columns[0], y] as const),
        ...rows.map((y) => [columns[1], y] as const),
    ];
}

function clockFor(view: Window): BrailleClock {
    const current = clocks.get(view);
    if (current) return current;
    const created: BrailleClock = { renderers: new Set(), request: undefined };
    clocks.set(view, created);
    return created;
}

function clockSchedule(view: Window, clock: BrailleClock): void {
    if (clock.request !== undefined || clock.renderers.size === 0) return;
    if (typeof view.requestAnimationFrame !== "function") return;
    clock.request = view.requestAnimationFrame((now) => {
        clock.request = undefined;
        for (const renderer of clock.renderers) renderer.draw(now);
        clockSchedule(view, clock);
    });
}

function clockAdd(view: Window, renderer: BrailleRenderer): () => void {
    const clock = clockFor(view);
    clock.renderers.add(renderer);
    clockSchedule(view, clock);
    return () => {
        clock.renderers.delete(renderer);
        if (clock.renderers.size !== 0 || clock.request === undefined) return;
        view.cancelAnimationFrame(clock.request);
        clock.request = undefined;
    };
}

class BrailleCanvasRenderer implements BrailleRenderer {
    readonly #canvas: HTMLCanvasElement;
    readonly #context: CanvasRenderingContext2D;
    readonly #root: HTMLElement;
    readonly #view: Window;
    readonly #startedAt: number;
    readonly #releaseClock: () => void;
    #observer: ResizeObserver | undefined;
    #width = 0;
    #height = 0;

    constructor(canvas: HTMLCanvasElement) {
        const context = canvas.getContext("2d");
        const root = canvas.parentElement;
        const view = canvas.ownerDocument.defaultView;
        if (!context || !root || !view) {
            throw new Error("Braille spinner requires a mounted 2D window canvas");
        }

        this.#canvas = canvas;
        this.#context = context;
        this.#root = root;
        this.#view = view;
        this.#startedAt = view.performance.now();
        this.#resizeFromCss(root.getBoundingClientRect());

        if (typeof view.ResizeObserver === "function") {
            this.#observer = new view.ResizeObserver(([entry]) => {
                if (!entry) return;
                const physical = entry.devicePixelContentBoxSize?.[0];
                const reportedAsCssPixels =
                    physical !== undefined &&
                    Math.abs(this.#view.devicePixelRatio - 1) > 0.01 &&
                    Math.abs(physical.inlineSize / entry.contentRect.width - 1) < 0.01 &&
                    Math.abs(physical.blockSize / entry.contentRect.height - 1) < 0.01;
                if (physical && !reportedAsCssPixels) {
                    this.#resize(physical.inlineSize, physical.blockSize);
                } else {
                    this.#resizeFromCss(entry.contentRect);
                }
                this.draw(this.#view.performance.now());
            });
            try {
                this.#observer.observe(root, { box: "device-pixel-content-box" });
            } catch {
                this.#observer.observe(root);
            }
        }

        this.#releaseClock = clockAdd(view, this);
        this.draw(this.#startedAt);
    }

    destroy(): void {
        this.#observer?.disconnect();
        this.#releaseClock();
    }

    draw(now: number): void {
        if (this.#width === 0 || this.#height === 0) return;
        const parked = this.#root.hasAttribute("data-paused");
        const parkedFrame = Number(this.#root.getAttribute("data-frame"));
        const elapsed =
            parked && Number.isFinite(parkedFrame)
                ? (modulo(parkedFrame, BRAILLE_FRAME_COUNT) + 0.75) * BRAILLE_FRAME_MS
                : now - this.#startedAt;

        const diameter = dotDiameter(this.#width, this.#height);
        const stamp = dotStamp(diameter);
        const origins = dotOrigins(this.#width, this.#height, diameter);
        const color = this.#view.getComputedStyle(this.#canvas).color;

        this.#context.clearRect(0, 0, this.#width, this.#height);
        this.#context.fillStyle = color;
        for (let dot = 0; dot < origins.length; dot += 1) {
            const origin = origins[dot]!;
            const phase = DOT_PHASES[dot]! * BRAILLE_FRAME_MS;
            this.#context.globalAlpha = dotOpacity(elapsed - phase);
            for (let y = 0; y < stamp.length; y += 1) {
                const [start, length] = stamp[y]!;
                if (length === 0) continue;
                this.#context.fillRect(origin[0] + start, origin[1] + y, length, 1);
            }
        }
        this.#context.globalAlpha = 1;
    }

    #resizeFromCss(box: Pick<DOMRectReadOnly, "width" | "height">): void {
        const ratio = this.#view?.devicePixelRatio || 1;
        this.#resize(box.width * ratio, box.height * ratio);
    }

    #resize(width: number, height: number): void {
        const nextWidth = Math.max(0, Math.round(width));
        const nextHeight = Math.max(0, Math.round(height));
        if (nextWidth === this.#width && nextHeight === this.#height) return;
        this.#width = nextWidth;
        this.#height = nextHeight;
        this.#canvas.width = nextWidth;
        this.#canvas.height = nextHeight;
        this.#context.imageSmoothingEnabled = false;
    }
}

/** React 19 callback ref: the renderer's lifetime is exactly the canvas's. */
export function brailleSpinnerCanvasAttach(
    canvas: HTMLCanvasElement | null,
): (() => void) | undefined {
    if (!canvas) return undefined;
    const renderer = new BrailleCanvasRenderer(canvas);
    return () => renderer.destroy();
}
