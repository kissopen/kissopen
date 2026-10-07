declare const __KISSOPEN_APP_VERSION__: string;

/**
 * The application's own version, fixed at build time from package.json — the
 * same source the renderer reads, and the one electron-builder names the
 * installer after.
 *
 * Not `app.getVersion()`: a development run starts Electron on `dist/main.js`,
 * where there is no package.json to read, and Electron then answers with its
 * own version. That number went on to the tray, the relay's client id and the
 * choice of update channel — the last of which then looked for stable agent
 * releases where only preview ones are published.
 */
export const appVersion: string = __KISSOPEN_APP_VERSION__;
