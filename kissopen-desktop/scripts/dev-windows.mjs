import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { build, createServer } from "vite";
import { artifactBinaryRead } from "../../scripts/agent-artifacts.mjs";

const workspace = resolve(import.meta.dirname, "..");
const desktop = join(workspace, "packages", "kissopen-desktop-electron");
const require = createRequire(join(desktop, "package.json"));

// Use Vite's API and the native Electron executable: no POSIX shell or pnpm
// subprocess is involved in the Windows development lifecycle.
export async function startNativeWindowsDev(options) {
    // Babel resolves compiler plugins from cwd, just like the package's Vite CLI.
    process.chdir(desktop);
    const port = Number(process.env.PORT ?? 5174);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535.");
    }
    const { directory, entry } = await artifactBinaryRead("win32", process.arch);
    const binary = join(directory, entry.file);
    if (!existsSync(binary)) {
        throw new Error(`Build or stage the Windows Agent before starting development: ${binary}`);
    }
    if (options.profile) {
        process.env.KISSOPEN_DESKTOP_PROFILE = "1";
        process.env.KISSOPEN_DESKTOP_PROFILE_MODE = "development";
    } else {
        delete process.env.KISSOPEN_DESKTOP_PROFILE;
        delete process.env.KISSOPEN_DESKTOP_PROFILE_MODE;
    }
    const environment = {
        ...process.env,
        KISSOPEN_DEV_AGENT_BINARY: binary,
        VITE_DEV_SERVER_URL: `http://127.0.0.1:${port}`,
        ...(options.debug ? { KISSOPEN_DESKTOP_DEBUG: "1" } : {}),
    };
    delete environment.ELECTRON_RUN_AS_NODE;
    const watchers = [];
    let server;
    let electron;
    let stopping;
    const stop = () =>
        (stopping ??= (async () => {
            if (electron && electron.exitCode === null && electron.pid) {
                await new Promise((done) => {
                    const terminator = spawn(
                        "taskkill.exe",
                        ["/PID", String(electron.pid), "/T", "/F"],
                        {
                            windowsHide: true,
                            stdio: "ignore",
                        },
                    );
                    terminator.once("error", done);
                    terminator.once("exit", done);
                });
            }
            await Promise.allSettled(watchers.map((watcher) => watcher.close()));
            await server?.close();
        })());
    const onSignal = () => {
        void stop();
    };
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, onSignal);
    try {
        server = await createServer({
            root: desktop,
            configFile: join(desktop, "vite.config.ts"),
            server: { host: options.lan ? "0.0.0.0" : "127.0.0.1", port, strictPort: true },
        });
        await server.listen();
        for (const config of ["vite.main.config.ts", "vite.preload.config.ts"]) {
            const watcher = await build({
                root: desktop,
                configFile: join(desktop, config),
                build: { watch: {} },
            });
            watchers.push(watcher);
            await new Promise((done, fail) => {
                const onEvent = (event) => {
                    if (event.code === "ERROR") {
                        watcher.off("event", onEvent);
                        fail(event.error);
                    } else if (event.code === "END") {
                        watcher.off("event", onEvent);
                        done();
                    }
                };
                watcher.on("event", onEvent);
            });
        }
        if (stopping) return;
        console.log(`KISSOPEN Dev: Windows native Electron · http://127.0.0.1:${port}/`);
        console.log("Save renderer source files to hot reload. Press Ctrl+C to stop.");
        electron = spawn(require("electron"), [join(desktop, "dist", "main.js")], {
            // This is the interactive app the user requested, not a hidden helper.
            cwd: desktop,
            env: environment,
            stdio: "inherit",
            windowsHide: false,
        });
        await new Promise((done, fail) => {
            electron.once("error", fail);
            electron.once("exit", (code) => {
                process.exitCode = stopping ? 0 : (code ?? 1);
                done();
            });
        });
    } finally {
        await stop();
        for (const signal of ["SIGINT", "SIGTERM"]) process.off(signal, onSignal);
    }
}
