import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { partitionComponentProps } from "./componentProps";
import { reducedMotionGet, reducedMotionSubscribe } from "./lottie/dotLottieRuntime";

export type NightSkyShaderMotion = "auto" | "still";

export interface NightSkyShaderProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    /** `still` draws the same deterministic frame without starting a render loop. */
    readonly motion?: NightSkyShaderMotion;
    /** Stable variation of the generated field. Defaults to the Kissopen night sky. */
    readonly seed?: number;
}

const DEFAULT_SEED = 7319;
const STILL_TIME_SECONDS = 23.75;

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/*
 * Three seeded star scales move at different rates over a low-frequency sky.
 * The shader deliberately leaves the centre quieter and more transparent than
 * the edges: this is scenery behind product copy, not an illustration the copy
 * has to compete with.
 */
const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
}

vec2 hash22(vec2 point) {
    float first = hash21(point);
    return vec2(first, hash21(point + first + 19.19));
}

float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);

    float lowerLeft = hash21(cell);
    float lowerRight = hash21(cell + vec2(1.0, 0.0));
    float upperLeft = hash21(cell + vec2(0.0, 1.0));
    float upperRight = hash21(cell + vec2(1.0, 1.0));
    return mix(
        mix(lowerLeft, lowerRight, local.x),
        mix(upperLeft, upperRight, local.x),
        local.y
    );
}

float cloudNoise(vec2 point) {
    float result = 0.0;
    float amplitude = 0.5;
    mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 4; octave++) {
        result += valueNoise(point) * amplitude;
        point = turn * point * 2.03 + vec2(11.7, 7.9);
        amplitude *= 0.5;
    }
    return result;
}

vec3 starLayer(
    vec2 point,
    float scale,
    float threshold,
    float radius,
    float drift,
    float offset
) {
    vec2 field = point * scale + vec2(u_time * drift, -u_time * drift * 0.43);
    vec2 cellId = floor(field);
    vec2 local = fract(field) - 0.5;
    vec2 seededCell = cellId + vec2(u_seed * 0.013 + offset, offset * 1.71);
    vec2 placement = (hash22(seededCell) - 0.5) * 0.72;
    vec2 delta = local - placement;

    float existence = smoothstep(threshold, 1.0, hash21(seededCell + 3.7));
    float character = hash21(seededCell + 8.3);
    float size = mix(radius * 0.62, radius * 1.86, character);
    float core = 1.0 - smoothstep(size, size * 2.35, length(delta));

    float rare = step(0.985, hash21(seededCell + 14.9));
    float vertical = 1.0 - smoothstep(0.0, size * 5.5, abs(delta.x));
    float horizontal = 1.0 - smoothstep(0.0, size * 5.5, abs(delta.y));
    float flare = vertical * horizontal * rare * 0.28;

    float twinkleRate = mix(0.90, 2.10, hash21(seededCell + 20.1));
    float twinklePhase = hash21(seededCell + 28.6) * 6.2831853;
    float twinkle = 0.74 + 0.26 * sin(u_time * twinkleRate + twinklePhase);

    float warm = smoothstep(0.86, 1.0, hash21(seededCell + 35.4));
    vec3 tint = mix(vec3(0.64, 0.78, 1.0), vec3(1.0, 0.79, 0.54), warm);
    tint = mix(tint, vec3(0.92, 0.96, 1.0), 0.62);
    return tint * (core + flare) * existence * twinkle;
}

void main() {
    vec2 point = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 cloudPoint = point * 1.74 + vec2(u_time * 0.0014, u_seed * 0.0007);
    float clouds = cloudNoise(cloudPoint);

    vec3 lowerNight = vec3(0.012, 0.021, 0.068);
    vec3 upperNight = vec3(0.022, 0.052, 0.132);
    float heightMix = smoothstep(-0.58, 0.62, point.y);
    vec3 colour = mix(lowerNight, upperNight, heightMix);

    float bandAxis = point.y + point.x * 0.23 - 0.12 + sin(point.x * 2.9) * 0.025;
    float band = exp(-abs(bandAxis) * 7.2) * (0.24 + clouds * 0.40);
    colour += vec3(0.040, 0.074, 0.146) * band;

    float horizon = 1.0 - smoothstep(-0.48, 0.08, point.y);
    horizon *= 1.0 - smoothstep(0.08, 1.10, abs(point.x));
    colour += vec3(0.026, 0.060, 0.105) * horizon;

    vec3 stars = vec3(0.0);
    stars += starLayer(point, 28.0, 0.935, 0.024, 0.0180, 4.0);
    stars += starLayer(point, 57.0, 0.968, 0.034, -0.0110, 31.0) * 0.82;
    stars += starLayer(point, 103.0, 0.986, 0.050, 0.0060, 83.0) * 0.56;

    float starLight = max(stars.r, max(stars.g, stars.b));
    float edge = smoothstep(0.14, 0.74, length(point * vec2(0.82, 1.08)));
    float opacity = mix(0.17, 0.58, edge) + min(0.15, starLight * 0.14) + band * 0.07;

    gl_FragColor = vec4(colour + stars, clamp(opacity, 0.0, 0.72));
}
`;

function shaderCompile(
    gl: WebGLRenderingContext,
    type: number,
    source: string,
): WebGLShader | undefined {
    const shader = gl.createShader(type);
    if (shader === null) return;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true) return shader;
    gl.deleteShader(shader);
}

function programCreate(gl: WebGLRenderingContext): WebGLProgram | undefined {
    const vertex = shaderCompile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = shaderCompile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (vertex === undefined || fragment === undefined) {
        if (vertex !== undefined) gl.deleteShader(vertex);
        if (fragment !== undefined) gl.deleteShader(fragment);
        return;
    }

    const program = gl.createProgram();
    if (program === null) {
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === true) return program;
    gl.deleteProgram(program);
}

/**
 * C-272 NightSkyShader — a generated, transparent night sky for quiet full-screen
 * scenery. WebGL draws one full-screen triangle; all stars, drift, twinkle, the
 * faint galactic band, and their layered parallax are evaluated in its fragment
 * shader, without DOM particles or React work per frame.
 *
 * It renders only while visible and the document is in front. Reduced motion,
 * or an explicit `still` fixture, draws one deterministic frame and starts no
 * animation loop. WebGL is decorative here: if a browser cannot create a
 * context, the transparent canvas leaves the host's ordinary surface intact.
 */
export function NightSkyShader(props: NightSkyShaderProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "motion",
        "seed",
    ]);
    const canvas = useRef<HTMLCanvasElement | null>(null);
    const reducedMotion = useSyncExternalStore(
        reducedMotionSubscribe,
        reducedMotionGet,
        () => true,
    );
    const moving = (local.motion ?? "auto") === "auto" && !reducedMotion;
    const seed =
        local.seed === undefined || !Number.isFinite(local.seed) ? DEFAULT_SEED : local.seed;

    /*
     * The WebGL context, GPU program, buffer, observers, document listener, and
     * animation frame are one imperative renderer lifetime. Keeping them in one
     * effect gives every resource the same complete teardown path.
     */
    // eslint-disable-next-line kissopen-react/no-layout-effect -- a committed canvas owns an imperative WebGL renderer, ResizeObserver, IntersectionObserver, visibility listener, and animation frame that must be created and released together
    useLayoutEffect(() => {
        const element = canvas.current;
        if (element === null) return;
        const document = element.ownerDocument;
        const view = document.defaultView;
        if (view === null) return;

        const gl = element.getContext("webgl", {
            alpha: true,
            antialias: false,
            depth: false,
            powerPreference: "high-performance",
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            stencil: false,
        });
        if (gl === null) return;
        const program = programCreate(gl);
        if (program === undefined) return;
        const triangle = gl.createBuffer();
        const position = gl.getAttribLocation(program, "a_position");
        const resolution = gl.getUniformLocation(program, "u_resolution");
        const time = gl.getUniformLocation(program, "u_time");
        const seedUniform = gl.getUniformLocation(program, "u_seed");
        if (
            triangle === null ||
            position < 0 ||
            resolution === null ||
            time === null ||
            seedUniform === null
        ) {
            if (triangle !== null) gl.deleteBuffer(triangle);
            gl.deleteProgram(program);
            return;
        }

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.uniform1f(seedUniform, seed);

        let frame: number | undefined;
        let shown = !document.hidden;
        let visible = typeof view.IntersectionObserver !== "function";
        const startedAt = view.performance.now() - STILL_TIME_SECONDS * 1000;

        const currentTime = () =>
            moving ? (view.performance.now() - startedAt) / 1000 : STILL_TIME_SECONDS;
        const draw = (seconds: number) => {
            if (gl.isContextLost()) return;
            gl.uniform2f(resolution, element.width, element.height);
            gl.uniform1f(time, seconds);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        const stop = () => {
            if (frame === undefined) return;
            view.cancelAnimationFrame(frame);
            frame = undefined;
        };
        const loop = (now: number) => {
            frame = undefined;
            if (!moving || !shown || !visible) return;
            draw((now - startedAt) / 1000);
            frame = view.requestAnimationFrame(loop);
        };
        const settle = () => {
            if (!moving || !shown || !visible) {
                stop();
                return;
            }
            if (frame === undefined) frame = view.requestAnimationFrame(loop);
        };
        const resize = () => {
            const bounds = element.getBoundingClientRect();
            const pixelRatio = Math.min(2, Math.max(1, view.devicePixelRatio || 1));
            const width = Math.max(1, Math.round(bounds.width * pixelRatio));
            const height = Math.max(1, Math.round(bounds.height * pixelRatio));
            if (element.width !== width || element.height !== height) {
                element.width = width;
                element.height = height;
                gl.viewport(0, 0, width, height);
            }
            draw(currentTime());
        };

        resize();

        const resizeObserver =
            typeof view.ResizeObserver === "function" ? new view.ResizeObserver(resize) : undefined;
        if (resizeObserver === undefined) view.addEventListener("resize", resize);
        else resizeObserver.observe(element);

        const intersectionObserver =
            typeof view.IntersectionObserver === "function"
                ? new view.IntersectionObserver((entries) => {
                      visible = entries.some((entry) => entry.isIntersecting);
                      settle();
                  })
                : undefined;
        intersectionObserver?.observe(element);

        const visibilityChanged = () => {
            shown = !document.hidden;
            settle();
        };
        const contextLost = () => {
            stop();
        };
        document.addEventListener("visibilitychange", visibilityChanged);
        element.addEventListener("webglcontextlost", contextLost);
        settle();

        return () => {
            stop();
            resizeObserver?.disconnect();
            if (resizeObserver === undefined) view.removeEventListener("resize", resize);
            intersectionObserver?.disconnect();
            document.removeEventListener("visibilitychange", visibilityChanged);
            element.removeEventListener("webglcontextlost", contextLost);
            if (!gl.isContextLost()) {
                gl.deleteBuffer(triangle);
                gl.deleteProgram(program);
            }
        };
    }, [moving, seed]);

    return (
        <canvas
            ref={canvas}
            aria-hidden="true"
            className={["kissopen-night-sky-shader", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="night-sky-shader"
            data-motion={moving ? "full" : "still"}
            data-seed={seed}
            data-testid={local["data-testid"]}
            style={local.style}
        />
    );
}
