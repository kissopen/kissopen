import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [tailwindcss(), react(), babel({ presets: [reactCompilerPreset()] })],
    build: {
        lib: {
            entry: resolve(import.meta.dirname, "sources/index.ts"),
            formats: ["es"],
            fileName: "index",
        },
        rollupOptions: {
            /*
             * A library build inlines every asset it bundles and offers no way
             * to opt out, so bundling the Lottie renderer here would base64 its
             * 1.8 MB ThorVG binary into a JavaScript chunk — parsed as source
             * rather than streamed to the WASM compiler, and carried whether or
             * not anything ever renders it. It stays external for the same
             * reason React does: this build produces a library, and a library
             * states its dependencies instead of swallowing them.
             *
             * What actually ships is `kissopen-desktop-electron`, an application build
             * that resolves this package to source and emits the binary as a
             * real `.wasm` file the browser streams on first use.
             */
            external: (id: string) =>
                ["react", "react-dom", "react/jsx-runtime"].includes(id) ||
                id === "@lottiefiles/dotlottie-web" ||
                id.startsWith("@lottiefiles/dotlottie-web/"),
        },
    },
    test: {
        exclude: [...configDefaults.exclude, "**/*.gym.test.tsx"],
        environment: "jsdom",
        setupFiles: [resolve(import.meta.dirname, "tests/setup.ts")],
    },
});
