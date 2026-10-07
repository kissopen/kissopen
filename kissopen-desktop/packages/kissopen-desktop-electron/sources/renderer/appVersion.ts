declare const __KISSOPEN_APP_VERSION__: string;

/**
 * The application's own version, fixed at build time from the package.json
 * electron-builder also names the installer after, so the number shown and the
 * number the updater compares against are the same one.
 */
export const appVersion: string = __KISSOPEN_APP_VERSION__;
