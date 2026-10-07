import { readFile } from "node:fs/promises";
import { join } from "node:path";

const GOLD_REPLAY_RELATIVE_PATH =
    "packages/kissopen-desktop-ui/dev/recordings/conversations/gold-five-minute-session.v1.json";

export interface GymGoldReplayMessage {
    readonly atMs: number;
    readonly source: string;
    readonly text: string;
}

export interface GymGoldReplayMaterial {
    readonly durationMs: number;
    readonly frameCount: number;
    readonly id: string;
    readonly label: string;
    readonly messages: readonly GymGoldReplayMessage[];
    readonly path: string;
}

/**
 * The UI replay recording is a gold source of realistic prompt, steering, and
 * tool-motion patterns. The mixed Electron workload extracts only submitted
 * user text and sends it through real Kissopen Agent sessions; it never injects the
 * recording's captured event rows into the durable server.
 */
export async function gymGoldReplayMaterialRead(
    workspaceRoot: string,
): Promise<GymGoldReplayMaterial> {
    const path = join(workspaceRoot, GOLD_REPLAY_RELATIVE_PATH);
    const recording = recordValue(JSON.parse(await readFile(path, "utf8")));
    if (recording === undefined) throw new Error(`Invalid gold replay recording: ${path}`);
    const frames = arrayValue(recording.frames);
    if (frames === undefined) throw new Error(`Gold replay frames are missing: ${path}`);
    const messages: GymGoldReplayMessage[] = [];
    for (const frameValue of frames) {
        const frame = recordValue(frameValue);
        const event = recordValue(frame?.event);
        if (event?.type !== "message_submitted") continue;
        const data = recordValue(event.data);
        const message = recordValue(data?.message);
        const blocks = arrayValue(message?.blocks);
        const text = blocks
            ?.map(recordValue)
            .find((block) => block?.type === "text" && typeof block.text === "string")?.text;
        if (
            typeof text !== "string" ||
            typeof frame?.atMs !== "number" ||
            !Number.isFinite(frame.atMs)
        ) {
            throw new Error(`Gold replay message frame is malformed: ${path}`);
        }
        messages.push({
            atMs: frame.atMs,
            source: typeof frame.source === "string" ? frame.source : "gold-replay",
            text,
        });
    }
    if (messages.length === 0)
        throw new Error(`Gold replay contains no submitted messages: ${path}`);
    return {
        durationMs: numberRequire(recording.durationMs, "durationMs", path),
        frameCount: frames.length,
        id: stringRequire(recording.id, "id", path),
        label: stringRequire(recording.label, "label", path),
        messages,
        path,
    };
}

function arrayValue(value: unknown): readonly unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function numberRequire(value: unknown, field: string, path: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Gold replay ${field} is invalid: ${path}`);
    }
    return value;
}

function stringRequire(value: unknown, field: string, path: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Gold replay ${field} is invalid: ${path}`);
    }
    return value;
}
