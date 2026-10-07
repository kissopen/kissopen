import { describe, expect, it } from "vitest";
import {
    DesktopRequestSchema,
    DesktopReplySchema,
    DESKTOP_PREVIEW_BYTES,
} from "./desktopManagement";

describe("closed encrypted desktop-management contract", () => {
    it("accepts only the supported local actions and relative paths", () => {
        expect(
            DesktopRequestSchema.parse({
                action: "library.directory",
                projectId: "project1",
                path: "uploads/notes",
                cursor: "100",
            }).action,
        ).toBe("library.directory");
        for (const path of [
            "/etc/passwd",
            "../secret",
            "notes/../../secret",
            "notes\\secret",
            "file\u0000",
        ]) {
            expect(
                DesktopRequestSchema.safeParse({
                    action: "library.read",
                    projectId: "project1",
                    path,
                }).success,
            ).toBe(false);
        }
        expect(
            DesktopRequestSchema.safeParse({
                action: "library.read",
                projectId: "project1",
                path: "",
            }).success,
        ).toBe(false);
        expect(DesktopRequestSchema.safeParse({ action: "shell", command: "whoami" }).success).toBe(
            false,
        );
        expect(
            DesktopRequestSchema.safeParse({ action: "plugins.list", url: "https://example.com" })
                .success,
        ).toBe(false);
    });
    it("requires a stable run identity and cannot select a cloud execution target", () => {
        expect(
            DesktopRequestSchema.safeParse({ action: "schedule.run", id: "task1" }).success,
        ).toBe(false);
        expect(
            DesktopRequestSchema.safeParse({
                action: "schedule.run",
                id: "task1",
                runId: "run1",
                target: "cloud",
            }).success,
        ).toBe(false);
        expect(
            DesktopRequestSchema.parse({ action: "schedule.run", id: "task1", runId: "run1" })
                .action,
        ).toBe("schedule.run");
    });
    it("projects plugin data without local paths, configuration or credentials", () => {
        const result = DesktopReplySchema.parse({
            ok: true,
            data: {
                kind: "plugins",
                applying: false,
                plugins: [
                    {
                        id: "plugin",
                        name: "Calendar",
                        description: "Local calendar",
                        version: "1",
                        enabled: true,
                        active: true,
                        removed: false,
                        skills: 1,
                        servers: 1,
                        unsupported: [],
                        config: "private",
                        root: "/private/path",
                        apiKey: "do-not-export",
                    },
                ],
            },
        });
        expect(JSON.stringify(result)).not.toMatch(/private|apiKey|do-not-export/);
    });
    it("rejects incompatible payloads and previews exceeding the mobile budget", () => {
        expect(DesktopReplySchema.safeParse({ ok: true, data: { kind: "unknown" } }).success).toBe(
            false,
        );
        expect(
            DesktopReplySchema.safeParse({
                ok: true,
                data: {
                    kind: "file",
                    name: "x",
                    hash: "h",
                    content: Buffer.alloc(DESKTOP_PREVIEW_BYTES + 1).toString("base64"),
                },
            }).success,
        ).toBe(false);
    });
});
