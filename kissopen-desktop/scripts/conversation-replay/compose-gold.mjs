import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [captureDirectory, outputFile] = process.argv.slice(2);
if (!captureDirectory || !outputFile) {
    throw new Error(
        "Usage: node scripts/conversation-replay/compose-gold.mjs <capture-directory> <output.json>",
    );
}

function capture(name) {
    return readFileSync(join(captureDirectory, name), "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line, index) => ({ ...JSON.parse(line), sourceLine: index + 1 }));
}

function parsedEvent(frame) {
    return JSON.parse(frame.data);
}

const EPOCH_KEYS = new Set([
    "activeSince",
    "createdAt",
    "dueAt",
    "since",
    "startedAt",
    "timestamp",
    "updatedAt",
]);
const SENSITIVE_TEXT = [
    "/Users/kirilldubovitskiy",
    "kirilldubovitskiy",
    "hmsk0flan003xvs2d00s2u2e",
    "MacBook Pro (7)",
];

/**
 * Moves a captured event into the composite clock without changing any delta
 * between its own frames. Only named epoch fields move; durations, token counts,
 * process ids, and every other number remain the captured values.
 */
function shiftEpochs(value, delta, key) {
    if (Array.isArray(value)) return value.map((item) => shiftEpochs(item, delta));
    if (value === null || typeof value !== "object") {
        return typeof value === "number" && key && EPOCH_KEYS.has(key) ? value + delta : value;
    }
    return Object.fromEntries(
        Object.entries(value).map(([childKey, child]) => [
            childKey,
            shiftEpochs(child, delta, childKey),
        ]),
    );
}

/**
 * The committed recording is safe to share: provider-encrypted reasoning is not
 * needed for rendering and personal workspace roots become a stable demo path.
 */
function sanitizeString(value) {
    return value
        .replaceAll(
            "/Users/kirilldubovitskiy/Kissopen/Folders/hmsk0flan003xvs2d00s2u2e/.work/tool-progress-motion",
            "/Users/demo/Kissopen/Projects/kissopen-desktop",
        )
        .replaceAll(
            "/Users/kirilldubovitskiy/Kissopen/Folders/hmsk0flan003xvs2d00s2u2e",
            "/Users/demo/Kissopen/Gold",
        )
        .replaceAll("/Users/kirilldubovitskiy", "/Users/demo")
        .replaceAll("kirilldubovitskiy", "demo")
        .replaceAll("MacBook Pro (7)", "Demo Mac");
}

function sanitize(value, key) {
    // These provider mirrors are cumulative copies of content already retained
    // as exact deltas/final blocks. ChatStore reads none of them during replay;
    // dropping them keeps the fixture small without changing one visible frame.
    if (key === "encrypted" || key === "partial" || key === "responseItems") return undefined;
    if (Array.isArray(value))
        return value.flatMap((item) => {
            const next = sanitize(item);
            return next === undefined ? [] : [next];
        });
    if (value !== null && typeof value === "object") {
        // Captured screenshots have not been separately reviewed for private
        // pixels. Keep their tool-result metadata, but omit the binary object.
        if (value.type === "image" && typeof value.data === "string") return undefined;
        return Object.fromEntries(
            Object.entries(value).flatMap(([childKey, child]) => {
                const next = sanitize(child, childKey);
                return next === undefined ? [] : [[childKey, next]];
            }),
        );
    }
    if (typeof value !== "string") return value;
    return sanitizeString(value);
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
 * Agent deltas can split a path at arbitrary character boundaries, so replacing
 * each frame independently is not sufficient. Reconstruct each logical stream,
 * sanitize it, then distribute the safe text over the original frame count.
 * Arrival timestamps and frame ordering stay untouched.
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

function assertSanitized(recording) {
    const serialized = JSON.stringify(recording);
    const reconstructed = [...deltaStreams(recording.frames).values()]
        .map((stream) => stream.map((event) => event.delta).join(""))
        .join("\n");
    for (const sensitive of SENSITIVE_TEXT) {
        if (serialized.includes(sensitive) || reconstructed.includes(sensitive)) {
            throw new Error(`Sanitizer left sensitive recording text: ${sensitive}`);
        }
    }
    const containsEmbeddedImage = (value) => {
        if (Array.isArray(value)) return value.some(containsEmbeddedImage);
        if (value === null || typeof value !== "object") return false;
        if (value.type === "image" && typeof value.data === "string") return true;
        return Object.values(value).some(containsEmbeddedImage);
    };
    if (containsEmbeddedImage(recording)) {
        throw new Error("Sanitizer left unreviewed embedded image data");
    }
}

const raw = capture("raw-trace-e2e.ndjson");
const subagent = capture("stream-capture.ndjson");
const sol = capture("sol-capture.ndjson");

// One complete 265.6-second run with two genuine mid-run user steering messages.
const CORE_START = 15_976 - 1;
const CORE_END = 18_715 - 1;
const core = raw.slice(CORE_START, CORE_END + 1);
const coreArrivalStart = core[0].t;
const firstEvent = parsedEvent(core[0]);
const startedAt = firstEvent.createdAt;
const sessionId = firstEvent.sessionId;

const frames = core.map((frame, index) => ({
    atMs: frame.t - coreArrivalStart,
    event: parsedEvent(frame),
    seq: index,
    source: "steering-core",
    sourceLine: frame.sourceLine,
}));

// Overlay the real 40.7-second Codex/Sol subagent lifecycle. These are session
// facts rather than parent inference blocks, so they can truthfully run beside
// the captured root turn without inventing a second projection path.
const SUBAGENT_START = 2_983 - 1;
const SUBAGENT_END = 3_772 - 1;
const subagentFrames = subagent
    .slice(SUBAGENT_START, SUBAGENT_END + 1)
    .filter((frame) => frame.event === "subagent_changed");
const subagentArrivalStart = subagentFrames[0].t;
const subagentAt = 139_000;
for (const frame of subagentFrames) {
    const atMs = subagentAt + frame.t - subagentArrivalStart;
    const event = shiftEpochs(parsedEvent(frame), startedAt + atMs - parsedEvent(frame).createdAt);
    event.sessionId = sessionId;
    frames.push({
        atMs,
        event,
        seq: frames.length,
        source: "subagent-overlay",
        sourceLine: frame.sourceLine,
    });
}

// The source capture predates structured Ask User telemetry. Keep a visible
// request interval in the gold specimen using the daemon's actual session-event
// shape, then resolve it so the later provider switch starts from a clean state.
// Place the synthetic pause inside a real quiet arrival window. That keeps the
// prompt as the final transcript row while it is pending, which matches how an
// actual Ask User tool blocks instead of letting unrelated captured work appear
// to continue beneath it.
const QUESTION_REQUEST_AT = 198_000;
const QUESTION_RESOLVE_AT = 208_400;
const questionRequest = {
    requestId: "gold-debug-port-question",
    questions: [
        {
            id: "debug-port",
            header: "Debug port",
            question:
                "How should the desktop debug port be enabled without replacing the existing dev:electron command that this folder's rules say to preserve?",
            multiSelect: false,
            required: true,
            options: [
                {
                    label: "Relaunch manually",
                    description:
                        "You run the Electron command with the remote-debugging flag whenever browser inspection is needed.",
                },
                {
                    label: "Add an env-gated switch",
                    description:
                        "Append the remote-debugging switch only when an environment variable is present, so the existing dev command keeps working unchanged.",
                },
                {
                    label: "Add a real setting",
                    description:
                        "Wire a persistent debug-port toggle into desktop settings and apply it during Electron startup.",
                },
            ],
        },
    ],
};
const questionRunId = frames.find((frame) => frame.event.type === "run_started")?.event.data.runId;
frames.push(
    {
        atMs: QUESTION_REQUEST_AT - 1,
        event: {
            createdAt: startedAt + QUESTION_REQUEST_AT - 1,
            data: {
                event: {
                    contentIndex: 0,
                    messageId: "gold-ask-user-message",
                    toolCall: {
                        arguments: { questions: questionRequest.questions },
                        id: questionRequest.requestId,
                        kind: "function",
                        name: "AskUserQuestion",
                        providerToolCallId: "gold-ask-user-provider-call",
                        type: "toolCall",
                        vendor: { type: "claude_tool_use" },
                    },
                    type: "toolcall_end",
                },
                runId: questionRunId,
            },
            id: "gold-ask-user-tool-call",
            sessionId,
            type: "agent_event",
        },
        seq: frames.length,
        source: "ask-user-overlay",
        sourceLine: 0,
    },
    {
        atMs: QUESTION_REQUEST_AT,
        event: {
            createdAt: startedAt + QUESTION_REQUEST_AT,
            data: questionRequest,
            id: "gold-user-input-requested",
            sessionId,
            type: "user_input_requested",
        },
        seq: frames.length + 1,
        source: "ask-user-overlay",
        sourceLine: 0,
    },
    {
        atMs: QUESTION_RESOLVE_AT,
        event: {
            createdAt: startedAt + QUESTION_RESOLVE_AT,
            data: {
                answers: {
                    "debug-port": ["Add an env-gated switch"],
                },
                requestId: questionRequest.requestId,
                status: "answered",
            },
            id: "gold-user-input-resolved",
            sessionId,
            type: "user_input_resolved",
        },
        seq: frames.length + 2,
        source: "ask-user-overlay",
        sourceLine: 0,
    },
);

// The source session never changed provider, so this is the single synthesized
// protocol frame in the recording. It is the daemon's real event shape and lands
// only after the first run is idle, exactly where the product permits the switch.
const PROVIDER_SWITCH_AT = 266_640;
frames.push({
    atMs: PROVIDER_SWITCH_AT,
    event: {
        createdAt: startedAt + PROVIDER_SWITCH_AT,
        data: {
            effort: "medium",
            modelId: "openai/gpt-5.6-sol",
            providerId: "codex",
            serviceTier: "priority",
        },
        id: "gold-provider-switch",
        sessionId,
        type: "session_configuration_changed",
    },
    seq: frames.length,
    source: "provider-switch",
    sourceLine: 0,
});

// A short second turn uses every captured Sol arrival delta from its first new
// inference iteration through its real run_finished. The listener attached after
// the run began, so the daemon-shaped submit/queue/start/running boundary is
// supplied here to keep ChatStore's status and activity internally consistent.
const SOL_TURN_AT = 267_640;
const solHello = parsedEvent(sol[0]);
const solRunId = solHello.session.activeTurn.runId;
const solMessageId = "gold-sol-followup-message";
const solBoundarySeq = frames.length;
frames.push(
    {
        atMs: SOL_TURN_AT,
        event: {
            createdAt: startedAt + SOL_TURN_AT,
            data: {
                delivery: "run",
                displayText:
                    "Switch to Sol and summarize what the background agent found about the replay.",
                message: {
                    blocks: [
                        {
                            text: "Switch to Sol and summarize what the background agent found about the replay.",
                            type: "text",
                        },
                    ],
                    id: solMessageId,
                    identity: null,
                    role: "user",
                },
                mutationId: solMessageId,
                runId: solRunId,
            },
            id: "gold-sol-message-submitted",
            sessionId,
            type: "message_submitted",
        },
        seq: solBoundarySeq,
        source: "sol-followup",
        sourceLine: 0,
    },
    {
        atMs: SOL_TURN_AT,
        event: {
            createdAt: startedAt + SOL_TURN_AT,
            data: { status: "queued" },
            id: "gold-sol-status-queued",
            sessionId,
            type: "session_status_changed",
        },
        seq: solBoundarySeq + 1,
        source: "sol-followup",
        sourceLine: 0,
    },
    {
        atMs: SOL_TURN_AT,
        event: {
            createdAt: startedAt + SOL_TURN_AT,
            data: {
                activity: {
                    kind: "queued",
                    label: "Queued",
                    since: startedAt + SOL_TURN_AT,
                },
            },
            id: "gold-sol-activity-queued",
            sessionId,
            type: "session_activity_changed",
        },
        seq: solBoundarySeq + 2,
        source: "sol-followup",
        sourceLine: 0,
    },
    {
        atMs: SOL_TURN_AT + 1,
        event: {
            createdAt: startedAt + SOL_TURN_AT + 1,
            data: { runId: solRunId },
            id: "gold-sol-run-started",
            sessionId,
            type: "run_started",
        },
        seq: solBoundarySeq + 3,
        source: "sol-followup",
        sourceLine: 0,
    },
    {
        atMs: SOL_TURN_AT + 1,
        event: {
            createdAt: startedAt + SOL_TURN_AT + 1,
            data: { status: "running" },
            id: "gold-sol-status-running",
            sessionId,
            type: "session_status_changed",
        },
        seq: solBoundarySeq + 4,
        source: "sol-followup",
        sourceLine: 0,
    },
    {
        atMs: SOL_TURN_AT + 1,
        event: {
            createdAt: startedAt + SOL_TURN_AT + 1,
            data: {
                activity: {
                    kind: "thinking",
                    label: "Thinking",
                    runId: solRunId,
                    since: startedAt + SOL_TURN_AT + 1,
                },
            },
            id: "gold-sol-activity-thinking",
            sessionId,
            type: "session_activity_changed",
        },
        seq: solBoundarySeq + 5,
        source: "sol-followup",
        sourceLine: 0,
    },
);

const solCreatedAtStart = solHello.session.activeTurn.startedAt;
for (const frame of sol.slice(3)) {
    // This listener attached 12.8 seconds after the Sol run began. Keeping that
    // real pre-capture wait makes the second turn's 40.8-second duration agree
    // with its protocol timestamps instead of pretending the listener was early.
    const atMs = SOL_TURN_AT + frame.t - solCreatedAtStart;
    const event = shiftEpochs(parsedEvent(frame), startedAt + SOL_TURN_AT - solCreatedAtStart);
    event.sessionId = sessionId;
    frames.push({
        atMs,
        event,
        seq: frames.length,
        source: "sol-followup",
        sourceLine: frame.sourceLine,
    });
}

frames.sort((left, right) => left.atMs - right.atMs || left.seq - right.seq);
frames.forEach((frame, seq) => {
    frame.seq = seq;
});
sanitizeDeltaStreams(frames);

const session = {
    activity: { kind: "idle", label: "Idle", since: startedAt - 1 },
    archived: false,
    backgroundProcesses: [],
    cwd: "/Users/demo/Kissopen/Gold",
    effort: "high",
    environment: { type: "local" },
    id: sessionId,
    modelId: "anthropic/fable-5",
    modelLocked: false,
    models: [
        {
            defaultThinkingLevel: "high",
            id: "anthropic/fable-5",
            name: "Fable 5",
            thinkingLevels: ["low", "medium", "high", "xhigh"],
        },
        {
            defaultThinkingLevel: "medium",
            id: "openai/gpt-5.6-sol",
            name: "GPT-5.6 Sol",
            thinkingLevels: ["low", "medium", "high", "xhigh"],
        },
    ],
    permissionMode: "auto",
    pendingSteeringMessages: [],
    pendingUserInputs: [],
    permissionReviews: [],
    projectId: "gold-project",
    providerId: "claude",
    snapshot: { messages: [] },
    status: "completed",
    subagents: [],
    tasks: [],
};
const transcript = {
    complete: true,
    messageCreatedAt: {},
    messageEventId: {},
    messageGroupId: {},
    messages: [],
    permissionReviews: [],
    turns: [],
};

const fable = {
    defaultThinkingLevel: "high",
    id: "anthropic/fable-5",
    name: "Fable 5",
    thinkingLevels: ["low", "medium", "high", "xhigh"],
};
const solModel = {
    defaultThinkingLevel: "medium",
    id: "openai/gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    thinkingLevels: ["low", "medium", "high", "xhigh"],
};

const recording = sanitize({
    version: 1,
    id: "gold-five-minute-session",
    label: "Gold · steering, subagent, provider switch · 5m",
    durationMs: 310_000,
    startedAt,
    manifest: {
        exactArrivalDeltas: true,
        notes: "One complete steering run plus a real Sol subagent lifecycle and Sol follow-up. Ten boundary/config/request protocol frames are synthesized: one Ask User tool/request interval, the provider switch, and the Sol submit/queue/start/running/initial-thinking boundary; all remaining frames preserve captured arrival deltas.",
        sanitizer: 2,
        sources: [
            "raw-trace-e2e.ndjson:15976-18715",
            "stream-capture.ndjson:2983-3772 (subagent_changed only)",
            "sol-capture.ndjson:4-end",
        ],
    },
    catalog: {
        defaultModelId: fable.id,
        defaultProviderId: "claude",
        models: [fable, solModel],
        providers: [
            { id: "claude", models: [fable], serviceTiers: [] },
            { id: "codex", models: [solModel], serviceTiers: ["priority"] },
        ],
    },
    hello: {
        activity: session.activity,
        resumed: false,
        session,
        transcript,
        usage: {
            currentProviderId: "claude",
            groups: [],
            quotas: [],
            sessionTokenCount: { lastContextTokens: 0, totalTokens: 0 },
        },
    },
    frames,
});
assertSanitized(recording);

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(recording)}\n`);
console.log(
    `wrote ${recording.frames.length} frames, ${(readFileSync(outputFile).byteLength / 1_048_576).toFixed(2)} MB, ${(recording.durationMs / 60_000).toFixed(1)} minutes`,
);
