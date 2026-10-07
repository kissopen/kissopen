import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build, defineConfig } from "vite";

const packageJson = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"),
) as { readonly version: string };

const flavor = process.env.KISSOPEN_DESKTOP_FLAVOR === "local-web" ? "local-web" : "standard";
const localWebOrigin =
    flavor === "local-web"
        ? process.env.KISSOPEN_LOCAL_WEB_ORIGIN ||
          "https://local.app.kissopen.com/downloads/kissopen-preview/"
        : null;

export default defineConfig({
    plugins: [
        {
            name: "browser-observation-source",
            enforce: "pre",
            async load(id) {
                if (!id.endsWith("browserObservation.ts?observation")) return;
                const entry = id.slice(0, -"?observation".length);
                this.addWatchFile(entry);
                const result = await build({
                    configFile: false,
                    root: import.meta.dirname,
                    publicDir: false,
                    logLevel: "silent",
                    build: {
                        write: false,
                        minify: true,
                        lib: { entry, name: "BrowserObservation", formats: ["iife"] },
                    },
                });
                const output = Array.isArray(result) ? result[0] : result;
                if (!("output" in output))
                    throw new Error("Browser observation bundle was not produced.");
                const chunk = output.output.find((item) => item.type === "chunk");
                if (!chunk || chunk.type !== "chunk")
                    throw new Error("Browser observation source is missing.");
                return (
                    "export default " +
                    JSON.stringify(
                        "(() => {" + chunk.code + "; return BrowserObservation.observe(); })()",
                    )
                );
            },
        },
    ],
    define: {
        __KISSOPEN_DESKTOP_FLAVOR__: JSON.stringify(flavor),
        // The application's own version. Read here rather than from
        // `app.getVersion()`, which answers with Electron's version in a
        // development run that has no package.json beside dist/main.js.
        __KISSOPEN_APP_VERSION__: JSON.stringify(packageJson.version),
        __KISSOPEN_LOCAL_WEB_ORIGIN__: JSON.stringify(localWebOrigin),
    },
    publicDir: false,
    build: {
        ssr: true,
        emptyOutDir: false,
        outDir: "dist",
        rollupOptions: {
            input: {
                main: resolve(import.meta.dirname, "sources/main/main.ts"),
            },
            external: [
                "electron",
                "electron-updater",
                "playwright-core",
                "ws",
                // Kept out of the bundle and shipped as a runtime dependency.
                // Nothing in the main process imports it since the notes
                // collection was removed, so this entry is inert; it is left in
                // place rather than changing the host build for no gain.
                "yjs",
            ],
            output: {
                entryFileNames: "[name].js",
            },
        },
    },
});
