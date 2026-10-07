import { kissopenProfilerBootstrap } from "./kissopenProfilerBootstrap";

/**
 * This is the only profile renderer entry. Keep the dynamic import below the
 * completed synchronous bootstrap so React and react-dom/profiling cannot
 * initialize before the official DevTools hook exists.
 */
try {
    kissopenProfilerBootstrap();
} catch (error) {
    // A profiler bootstrap failure must not prevent the app itself from opening.
    // The main process will truthfully keep React attribution unavailable.
    console.error("KissOpen profiler bootstrap failed.", error);
}

await import("./renderer");
