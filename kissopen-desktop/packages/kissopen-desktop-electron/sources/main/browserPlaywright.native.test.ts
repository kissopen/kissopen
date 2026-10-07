import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { expect, it } from "vitest";
import mainConfig from "../../vite.main.config";

// Native integration runs in a disposable Electron profile, never the user's
// application or browser. Opt in on a machine with a working display.
it.skipIf(process.env.KISSOPEN_BROWSER_NATIVE_TESTS !== "1")(
    "operates cross-site embedded frames, bounded batches, waits and retained login sessions",
    async () => {
        const temporary = await mkdtemp(join(tmpdir(), "kissopen-browser-native-tests-"));
        const target = resolve(temporary);
        if (
            dirname(target) !== resolve(tmpdir()) ||
            !basename(target).startsWith("kissopen-browser-native-tests-")
        )
            throw new Error("Unsafe native test cleanup target");
        const require = createRequire(import.meta.url);
        let child: ReturnType<typeof spawn> | undefined;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
            const result = await build({
                ...mainConfig,
                configFile: false,
                root: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
                logLevel: "silent",
                build: {
                    ...mainConfig.build,
                    write: false,
                    rollupOptions: {
                        ...mainConfig.build?.rollupOptions,
                        input: fileURLToPath(new URL("./browserPlaywright.ts", import.meta.url)),
                        preserveEntrySignatures: "strict",
                        output: { format: "es" },
                    },
                },
            });
            const output = Array.isArray(result) ? result[0] : result;
            if (!("output" in output)) throw new Error("Native browser bundle missing");
            const entry = output.output.find((item) => item.type === "chunk" && item.isEntry);
            if (!entry || entry.type !== "chunk") throw new Error("Native browser entry missing");
            const source = entry.code
                .replaceAll(
                    'from "ws"',
                    `from ${JSON.stringify(pathToFileURL(join(dirname(require.resolve("ws")), "wrapper.mjs")).href)}`,
                )
                .replaceAll(
                    'from "playwright-core"',
                    `from ${JSON.stringify(pathToFileURL(join(dirname(require.resolve("playwright-core")), "index.mjs")).href)}`,
                );
            await writeFile(join(temporary, "browserPlaywright.mjs"), source);
            const environment: NodeJS.ProcessEnv = {
                ...process.env,
                KISSOPEN_HOME_DIR: temporary,
                KISSOPEN_BROWSER_TEST_DIRECTORY: temporary,
            };
            delete environment.ELECTRON_RUN_AS_NODE;
            child = spawn(
                require("electron"),
                [fileURLToPath(new URL("./browserPlaywright.native.fixture.cjs", import.meta.url))],
                { env: environment, windowsHide: true },
            );
            let log = "";
            child.stdout?.on("data", (bytes) => {
                log += bytes.toString();
            });
            child.stderr?.on("data", (bytes) => {
                log += bytes.toString();
            });
            deadline = setTimeout(() => child?.kill(), 45000);
            const exitCode = await new Promise<number | null>((resolve, reject) => {
                child!.once("error", reject);
                child!.once("exit", resolve);
            });
            const report = JSON.parse(
                await readFile(join(temporary, "iframe-report.json"), "utf8"),
            ) as { checks: string[]; failures: string[] };
            expect(report.failures, log).toEqual([]);
            expect(exitCode, log).toBe(0);
            expect(report.checks.length).toBeGreaterThanOrEqual(18);
        } finally {
            if (deadline) clearTimeout(deadline);
            if (child && child.exitCode === null && child.signalCode === null) child.kill();
            await rm(target, { recursive: true, force: true });
        }
    },
    60000,
);
