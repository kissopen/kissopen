import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

const [captureFile, outputFile] = process.argv.slice(2);
if (!captureFile || !outputFile) {
    throw new Error(
        "Usage: node scripts/conversation-replay/compose-subagent-gold.mjs <capture.ndjson> <output.json>",
    );
}

const raw = readFileSync(captureFile, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line, index) => ({ ...JSON.parse(line), sourceLine: index + 1 }));
const helloFrame = raw.find((frame) => frame.event === "hello");
if (!helloFrame) throw new Error("The capture has no session hello frame.");
const rawHello = JSON.parse(helloFrame.data);

const KEPT_EVENTS = new Set([
    "agent_event",
    "agent_message",
    "message_submitted",
    "run_finished",
    "run_started",
    "session_activity_changed",
    "session_context_changed",
    "session_status_changed",
    "steering_applied",
    "subagent_changed",
]);
const captured = raw
    .filter((frame) => frame !== helloFrame && KEPT_EVENTS.has(frame.event))
    .map((frame) => ({ ...frame, parsed: JSON.parse(frame.data) }));
if (captured.length === 0) throw new Error("The capture has no replayable session events.");

const firstArrival = captured[0].t;
const startedAt = captured[0].parsed.createdAt;
const sourceSessionId = rawHello.session.id;
const sourceAgentId = rawHello.session.agentId;
const sourceOwnerId = rawHello.session.ownerInstanceId;
const sourceProjectId = rawHello.session.projectId;

const replacements = new Map([
    [
        "/Users/kirilldubovitskiy/Kissopen/Folders/hmsk0flan003xvs2d00s2u2e/.work/tool-progress-motion",
        "/Users/demo/Kissopen/Projects/kissopen-desktop",
    ],
    ["/Users/kirilldubovitskiy/Kissopen/Folders/hmsk0flan003xvs2d00s2u2e", "/Users/demo/Kissopen/Gold"],
    ["/Users/kirilldubovitskiy", "/Users/demo"],
    ["kirill@bra1ndump", "demo-provider"],
    ["kirilldubovitskiy", "demo"],
    ["MacBook Pro (7)", "Demo Mac"],
    [sourceSessionId, "gold-subagent-session"],
    ...(sourceAgentId ? [[sourceAgentId, "gold-parent-agent"]] : []),
    ...(sourceOwnerId ? [[sourceOwnerId, "gold-owner"]] : []),
    ...(sourceProjectId ? [[sourceProjectId, "gold-project"]] : []),
]);

const subagents = new Map();
for (const frame of captured) {
    if (frame.parsed.type !== "subagent_changed") continue;
    const subagent = frame.parsed.data?.subagent;
    if (!subagent?.taskName || subagents.has(subagent.id)) continue;
    subagents.set(subagent.id, subagent);
    const safeName = subagent.taskName.replaceAll("_", "-");
    replacements.set(subagent.id, `gold-subagent-${safeName}`);
    if (subagent.agentId) replacements.set(subagent.agentId, `gold-agent-${safeName}`);
}
if (subagents.size < 2) {
    throw new Error(`Expected a multi-subagent capture, found ${String(subagents.size)} children.`);
}

const orderedReplacements = [...replacements].sort(([left], [right]) => right.length - left.length);

function sanitizeString(value) {
    let sanitized = value;
    for (const [source, replacement] of orderedReplacements) {
        sanitized = sanitized.replaceAll(source, replacement);
    }
    return sanitized.replaceAll(
        /gAAAAA[A-Za-z0-9_-]+/g,
        "[encrypted collaboration payload omitted]",
    );
}

function sanitize(value, key) {
    if (
        key === "apiKey" ||
        key === "encrypted" ||
        key === "partial" ||
        key === "prompt" ||
        key === "responseItems" ||
        key === "token"
    ) {
        return undefined;
    }
    if (Array.isArray(value))
        return value.flatMap((item) => {
            const next = sanitize(item);
            return next === undefined ? [] : [next];
        });
    if (value !== null && typeof value === "object") {
        if (value.type === "image" && typeof value.data === "string") return undefined;
        return Object.fromEntries(
            Object.entries(value).flatMap(([childKey, child]) => {
                const next = sanitize(child, childKey);
                return next === undefined ? [] : [[childKey, next]];
            }),
        );
    }
    return typeof value === "string" ? sanitizeString(value) : value;
}

function deltaStreams(frames) {
    const streams = new Map();
    for (const frame of frames) {
        const outer = frame.event;
        const inner = outer?.type === "agent_event" ? outer.data?.event : undefined;
        if (!inner || typeof inner.delta !== "string") continue;
        const key = [
            outer.sessionId,
            outer.data?.runId,
            inner.type,
            inner.messageId,
            inner.contentIndex,
        ].join(":");
        const stream = streams.get(key) ?? [];
        stream.push(inner);
        streams.set(key, stream);
    }
    return streams;
}

/**
 * A path or identity can be split at arbitrary token boundaries. Reconstruct
 * each stream, sanitize the whole value, then repartition it over the exact
 * captured frame count so timing and ordering stay real.
 */
function sanitizeDeltaStreams(frames) {
    for (const stream of deltaStreams(frames).values()) {
        const source = stream.map((event) => event.delta).join("");
        const sanitized = sanitizeString(source);
        let sourceCursor = 0;
        let sanitizedCursor = 0;
        for (const [index, event] of stream.entries()) {
            sourceCursor += event.delta.length;
            const sanitizedEnd =
                index === stream.length - 1
                    ? sanitized.length
                    : Math.round((sanitized.length * sourceCursor) / source.length);
            event.delta = sanitized.slice(sanitizedCursor, sanitizedEnd);
            sanitizedCursor = sanitizedEnd;
        }
    }
}

const frames = captured.map((frame, seq) => ({
    atMs: frame.t - firstArrival,
    event: sanitize(frame.parsed),
    seq,
    source: "subagent-lifecycle",
    sourceLine: frame.sourceLine,
}));
sanitizeDeltaStreams(frames);

const modelIds = new Set(["openai/gpt-5.6-sol"]);
for (const subagent of subagents.values()) modelIds.add(subagent.modelId);
const models = rawHello.session.modelCatalog.models.filter((model) => modelIds.has(model.id));
const codexProvider = rawHello.session.modelCatalog.providers.find(
    (provider) => provider.providerId === "codex",
);
if (!codexProvider) throw new Error("The capture has no Codex provider catalog.");
const protocolCatalog = {
    defaultModelId: "openai/gpt-5.6-sol",
    defaultProviderId: "codex",
    models,
    providers: [{ ...codexProvider, models }],
};
const catalog = {
    defaultModelId: protocolCatalog.defaultModelId,
    defaultProviderId: protocolCatalog.defaultProviderId,
    models,
    providers: [
        {
            id: "codex",
            models,
            serviceTiers: codexProvider.serviceTiers ?? [],
        },
    ],
};

const hello = sanitize({
    ...rawHello,
    lastEventId: undefined,
    usage: {
        currentProviderId: "codex",
        groups: [],
        quotas: [],
        sessionTokenCount: { lastContextTokens: 0, totalTokens: 0 },
    },
    session: {
        ...rawHello.session,
        id: sourceSessionId,
        agentId: sourceAgentId,
        ownerInstanceId: sourceOwnerId,
        projectId: sourceProjectId,
        modelCatalog: protocolCatalog,
        models,
        projectSecretIds: [],
        secretIds: [],
        sessionSecretIds: [],
        externalTools: [],
        skills: [],
    },
});

const durationMs = frames.at(-1).atMs + 1_000;
const recording = {
    version: 1,
    id: "gold-subagent-lifecycle",
    label: "Gold · delegated subagents · real lifecycle",
    durationMs,
    startedAt,
    manifest: {
        exactArrivalDeltas: true,
        notes: "One fresh read-only Sol parent run with three concurrent Sol/Terra subagents, completion notifications, one finished-agent follow-up, and a parent synthesis. Every replay frame and arrival delta is captured; none are synthesized.",
        sanitizer: 3,
        sources: [`${basename(captureFile)}:2-end`],
    },
    catalog,
    hello,
    frames,
};

function assertSanitized() {
    const serialized = JSON.stringify(recording);
    const reconstructed = [...deltaStreams(frames).values()]
        .map((stream) => stream.map((event) => event.delta).join(""))
        .join("\n");
    const forbidden = [
        ...replacements.keys(),
        "kirill@bra1ndump",
        "apiKey",
        '"encrypted"',
        "gAAAAA",
        '"prompt"',
        '"quotas":[{',
        '"responseItems"',
    ];
    for (const sensitive of forbidden) {
        if (serialized.includes(sensitive) || reconstructed.includes(sensitive)) {
            throw new Error(`Sanitizer left sensitive recording text: ${sensitive}`);
        }
    }
    if (frames.some((frame, index) => frame.seq !== index)) {
        throw new Error("Recording frames are not contiguous.");
    }
}
assertSanitized();

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(recording)}\n`);
console.log(
    `wrote ${String(frames.length)} real frames, ${subagents.size} subagents, ${(readFileSync(outputFile).byteLength / 1_048_576).toFixed(2)} MB, ${(durationMs / 1_000).toFixed(1)} seconds`,
);
