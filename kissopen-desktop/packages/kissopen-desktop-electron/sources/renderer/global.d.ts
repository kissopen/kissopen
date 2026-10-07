import type {
    KissopenDesktopBridge,
    KissopenMediaPreviewBridge,
    KissopenQuickBarBridge,
} from "../shared/desktopContract";

declare global {
    const __KISSOPEN_DESKTOP_PROFILE__: boolean;

    interface Window {
        kissopenDesktop?: KissopenDesktopBridge;
        /** Present only in the window that shows one file, and never beside `kissopenDesktop`. */
        kissopenMediaPreview?: KissopenMediaPreviewBridge;
        /** Present only in the bar at the bottom of the screen, and never beside the others. */
        kissopenQuickBar?: KissopenQuickBarBridge;
    }
}

export {};
