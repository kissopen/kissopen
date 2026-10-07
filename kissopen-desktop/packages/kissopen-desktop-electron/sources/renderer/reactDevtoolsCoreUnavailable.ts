/**
 * Normal Kissopen builds keep the official profiler backend out of the renderer
 * bundle. The profile build aliases the same import to the exact pinned
 * react-devtools-core package; this typed no-op preserves the ordinary build's
 * startup and attribution-unavailable contract.
 */
export function initialize(): void {}

export function connectWithCustomMessagingProtocol(): () => void {
    return () => undefined;
}
