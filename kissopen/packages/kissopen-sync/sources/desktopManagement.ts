import { z } from "zod";

export const DESKTOP_MANAGEMENT_METHOD = "kissopen-desktop-manage";
export const DESKTOP_PREVIEW_BYTES = 384 * 1024;
export const DESKTOP_RESPONSE_BYTES = 700_000;
export const DesktopRosterSchema = z.array(
    z.object({ id: z.string(), dataEncryptionKey: z.string().nullable().optional() }),
);
export const DesktopPacketSchema = z.object({
    method: z.string(),
    params: z.string().max(DESKTOP_RESPONSE_BYTES),
});
const id = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/);
const path = z
    .string()
    .max(4096)
    .refine(
        (value) =>
            !value.startsWith("/") &&
            !/[\\\x00-\x1f]/.test(value) &&
            !value.split("/").includes(".."),
        "Use a relative project path.",
    );
export const DesktopRequestSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("status") }).strict(),
    z.object({ action: z.literal("plugins.list") }).strict(),
    z.object({ action: z.literal("schedules.list") }).strict(),
    z.object({ action: z.literal("schedule.runs"), id }).strict(),
    z
        .object({ action: z.literal("schedule.status"), id, status: z.enum(["active", "paused"]) })
        .strict(),
    z.object({ action: z.literal("schedule.run"), id, runId: id }).strict(),
    z.object({ action: z.literal("library.projects") }).strict(),
    z
        .object({
            action: z.literal("library.directory"),
            projectId: id,
            path,
            cursor: z.string().max(4096).optional(),
        })
        .strict(),
    z
        .object({
            action: z.literal("library.read"),
            projectId: id,
            path: path.refine((value) => value.length > 0),
        })
        .strict(),
]);
export type DesktopRequest = z.infer<typeof DesktopRequestSchema>;
const RunSchema = z.object({
    id: z.string(),
    status: z.string(),
    summary: z.string(),
    error: z.string(),
    scheduled_for: z.number(),
    started_at: z.number(),
    ended_at: z.number(),
    session_id: z.string(),
});
const ScheduleSchema = z.object({
    id: z.string(),
    name: z.string(),
    instruction: z.string(),
    status: z.string(),
    timezone: z.string(),
    recurrence: z.string(),
    interval_minutes: z.number(),
    at_minute: z.number(),
    next_run_at: z.number(),
    project_name: z.string().nullable().optional(),
    last_run: RunSchema.optional(),
});
const PluginSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    version: z.string(),
    enabled: z.boolean(),
    active: z.boolean(),
    removed: z.boolean(),
    skills: z.number(),
    servers: z.number(),
    unsupported: z.array(z.string()),
});
export const DesktopDataSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("status"), version: z.literal(1) }),
    z.object({
        kind: z.literal("plugins"),
        plugins: z.array(PluginSchema),
        applying: z.boolean(),
        error: z.string().optional(),
    }),
    z.object({ kind: z.literal("schedules"), schedules: z.array(ScheduleSchema) }),
    z.object({ kind: z.literal("runs"), runs: z.array(RunSchema) }),
    z.object({ kind: z.literal("ack") }),
    z.object({
        kind: z.literal("projects"),
        projects: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
    z.object({
        kind: z.literal("directory"),
        entries: z.array(
            z.object({
                name: z.string(),
                path: z.string(),
                type: z.enum(["file", "directory", "symlink", "other"]),
                size: z.number(),
                modified: z.number(),
            }),
        ),
        nextCursor: z.string().nullable(),
    }),
    z.object({
        kind: z.literal("file"),
        name: z.string(),
        content: z.string().max(524288),
        hash: z.string(),
    }),
]);
export const DesktopReplySchema = z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: DesktopDataSchema }),
    z.object({
        ok: z.literal(false),
        code: z.enum(["invalid", "forbidden", "missing", "too_large", "unavailable"]),
        error: z.string(),
    }),
]);
export type DesktopData = z.infer<typeof DesktopDataSchema>;
export type DesktopReply = z.infer<typeof DesktopReplySchema>;
