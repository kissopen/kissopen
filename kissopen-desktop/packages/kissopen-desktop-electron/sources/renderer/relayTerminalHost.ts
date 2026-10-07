/*
Opening a terminal on another machine, through the window's own terminal.

The store, the driver and the emulator are the local ones. What they ask for
is three things — which folder, how to start a shell in it, and a duplex of
bytes — and all three are answerable about a machine across the room. So this
supplies them rather than building a second terminal.

The relay addresses terminals by session, and the agent resolves the folder
from that session itself, so what the local store calls a "workspace" is the
session here. That is not a shortcut: the folder a session's terminal stands
in is decided on the machine that owns it, which is the only place that can
decide it.
*/
import {
    kissopenAgentTerminalOpen,
    type KissopenAgentGroupId,
    type KissopenAgentSessionId,
    type KissopenAgentTerminalHandle,
    type KissopenAgentTerminalId,
    type TerminalColorScheme,
    type TerminalDriverCreate,
} from "kissopen-desktop-state";
import { relayTerminalConnection } from "./relayTerminalConnection";
import type { KissopenDesktopBridge } from "../shared/desktopContract";

/**
 * Starts one terminal in the folder a remote session stands in.
 *
 * The handle is the local one, so a shell on a Mac and a shell here are the
 * same tab, the same keys and the same screen. Only the pipe differs, and the
 * pipe is the main process's, because the relay credential is.
 */
export function relayTerminalOpen(options: {
    readonly bridge: KissopenDesktopBridge;
    readonly sessionId: string;
    readonly colorScheme: TerminalColorScheme;
    readonly driverCreate: TerminalDriverCreate;
}): KissopenAgentTerminalHandle {
    const { bridge, sessionId } = options;
    return kissopenAgentTerminalOpen(
        {
            colorScheme: options.colorScheme,
            driverCreate: options.driverCreate,
            client: {
                /*
                 * The session is its own workspace here: the machine resolves
                 * the folder from the session, so there is nothing else to
                 * name it by, and naming it twice would be two answers to one
                 * question.
                 */
                getAgent: async (agentId: string) => ({ agent: { workspaceId: agentId } }) as never,
                openTerminal: async (
                    _workspaceId: string,
                    request?: {
                        cols?: number;
                        rows?: number;
                        colorScheme?: TerminalColorScheme;
                    },
                ) => {
                    const answer = await bridge.relayTerminalCreate(sessionId, {
                        ...(request?.cols === undefined ? {} : { cols: request.cols }),
                        ...(request?.rows === undefined ? {} : { rows: request.rows }),
                        ...(request?.colorScheme === undefined
                            ? {}
                            : { colorScheme: request.colorScheme }),
                    });
                    if (!answer.ok) throw new Error(answer.error);
                    /*
                     * A terminal still running has no exit code, and the local
                     * store spells that absence `null`. Handing it `undefined`
                     * instead would read as "not told yet" in a screen that
                     * has been told.
                     */
                    return {
                        terminal: {
                            ...answer.terminal,
                            exitCode: answer.terminal.exitCode ?? null,
                        },
                    } as never;
                },
                stopTerminal: async (_workspaceId: string, terminalId: string) => {
                    const answer = await bridge.relayTerminalStop(sessionId, terminalId);
                    if (!answer.ok) throw new Error(answer.error);
                    return undefined as never;
                },
            } as never,
            hostServices: {
                terminalConnect: (
                    _workspaceId: KissopenAgentGroupId,
                    terminalId: KissopenAgentTerminalId,
                ) => relayTerminalConnection(bridge, sessionId, terminalId),
            },
        },
        sessionId as KissopenAgentSessionId,
    );
}
