declare module "react-devtools-core" {
    /**
     * react-devtools-core 6.1.5's wall.listen contract is one event/payload
     * envelope. Keep this local declaration pinned to the reviewed package;
     * passing positional arguments silently drops every command in Bridge.
     */
    interface DesktopReactDevtoolsWallMessage {
        readonly event: string;
        readonly payload: unknown;
    }

    export function initialize(settings?: {
        readonly appendComponentStack?: boolean;
        readonly breakOnConsoleErrors?: boolean;
        readonly hideConsoleLogsInStrictMode?: boolean;
        readonly showInlineWarningsAndErrors?: boolean;
    }): void;

    export function connectWithCustomMessagingProtocol(options: {
        readonly onMessage: (event: string, payload: unknown) => void;
        readonly onSubscribe: (
            listener: (message: DesktopReactDevtoolsWallMessage) => void,
        ) => void;
        readonly onUnsubscribe: (
            listener: (message: DesktopReactDevtoolsWallMessage) => void,
        ) => void;
    }): (() => void) | undefined;
}
