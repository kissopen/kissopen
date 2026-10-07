// Renderer-input validation for the Kissopen Agent IPC that is left. The rich Kissopen Agent data
// connection no longer flows over IPC (the renderer reaches the daemon through
// the main process's HTTP proxy), so what remains is the install terminal's
// input and size, and the address a browser tunnel is opened on.

import type { DesktopBrowserCommand, DesktopBrowserProxyTarget } from "../shared/desktopContract";

export function desktopBrowserCommandValidate(value: unknown): DesktopBrowserCommand {
    if (typeof value !== "object" || value === null) throw new Error("Invalid browser command.");
    const command = value as { action?: unknown; url?: unknown };
    if (
        command.action === "load" &&
        Object.keys(value).every((key) => key === "action" || key === "url")
    )
        return { action: "load", url: boundedString(command.url, "Browser address", 65536) };
    if (
        Object.keys(value).length === 1 &&
        (command.action === "back" ||
            command.action === "forward" ||
            command.action === "reload" ||
            command.action === "stop")
    )
        return { action: command.action };
    throw new Error("Invalid browser command.");
}

/** The explicit Kissopen Agent connection and workspace a browser tunnel is asked for. */
export function desktopBrowserProxyTargetValidate(value: unknown): DesktopBrowserProxyTarget {
    if (typeof value !== "object" || value === null)
        throw new Error("The WorPar Agent browser target is invalid.");
    const target = value as { readonly connectionId?: unknown; readonly workspaceId?: unknown };
    const connectionId =
        target.connectionId === null
            ? null
            : boundedString(
                  target.connectionId,
                  "The WorPar Agent browser connection identity",
                  256,
              );
    const workspaceId = boundedString(
        target.workspaceId,
        "The WorPar Agent browser workspace identity",
        256,
    );
    return { connectionId, workspaceId };
}

export function kissopenAgentTerminalInputValidate(value: unknown): string {
    return boundedString(value, "Terminal input", 65_536, true);
}

export function kissopenAgentTerminalSizeValidate(cols: unknown, rows: unknown) {
    return terminalSize(cols, rows);
}

function boundedString(value: unknown, label: string, maximum: number, empty = false): string {
    if (
        typeof value !== "string" ||
        (!empty && value.length === 0) ||
        value.length > maximum ||
        value.includes("\0")
    )
        throw new Error(`${label} is invalid.`);
    return value;
}

function terminalSize(cols: unknown, rows: unknown) {
    if (
        !Number.isSafeInteger(cols) ||
        !Number.isSafeInteger(rows) ||
        (cols as number) < 2 ||
        (cols as number) > 1000 ||
        (rows as number) < 1 ||
        (rows as number) > 1000
    )
        throw new Error("The WorPar Agent terminal size is invalid.");
    return { cols: cols as number, rows: rows as number };
}
