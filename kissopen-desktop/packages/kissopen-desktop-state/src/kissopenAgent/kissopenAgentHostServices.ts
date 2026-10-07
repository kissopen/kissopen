import type { TerminalConnection } from "../transport.js";
import type {
    KissopenAgentGroupId,
    KissopenAgentOpenInTarget,
    KissopenAgentOpenInTargets,
    KissopenAgentTerminalId,
    KissopenAgentWorkspaceFileBytes,
} from "./kissopenAgentTypes.js";

/**
 * Desktop-local services that are not Kissopen Agent product resources.
 *
 * The state package talks to Kissopen Agent directly for every `/v0` read and
 * mutation. This boundary is intentionally limited to work that needs the
 * desktop host: launching another application, turning local bytes into an
 * isolated preview asset, placing an attachment chosen by the user, and
 * attaching the terminal's binary WebSocket protocol.
 */
export interface KissopenAgentHostServices {
    openInTargetsRead(): Promise<KissopenAgentOpenInTargets>;
    /**
     * Hands the group's directory to that application, and records it as the one
     * this machine opened a project in most recently. The whole target is passed
     * because the host is what remembers the choice across a reload, and the
     * control that wears it needs the label and the icon, not only the id.
     */
    openIn(groupId: KissopenAgentGroupId, target: KissopenAgentOpenInTarget): Promise<void>;
    /**
     * Opens one document in the group's checkout with the application this
     * machine uses for its type — Word for a .docx, PowerPoint for a .pptx.
     */
    fileOpenDefault(groupId: KissopenAgentGroupId, path: string): Promise<void>;
    workspaceFileBytesRead(
        groupId: KissopenAgentGroupId,
        path: string,
        signal?: AbortSignal,
    ): Promise<KissopenAgentWorkspaceFileBytes>;
    htmlPreviewOpen(groupId: KissopenAgentGroupId, path: string): Promise<string>;
    /**
     * Where a file the reader chose lives on this machine, when it lives
     * anywhere. A pasted screenshot exists only in the browser and answers
     * undefined, as does a host that cannot tell.
     */
    attachmentSourcePath(file: File): string | undefined;
    /**
     * Whether an agent working in this group could open that path as it stands,
     * because its work and the reader's disk are the same machine. When they
     * are, an attachment needs no transfer at all and is named where it lies.
     * A container workspace and a Kissopen Agent on another machine both answer false, and
     * the caller sends the bytes instead.
     */
    attachmentSourceReachable(groupId: KissopenAgentGroupId, sourcePath: string): Promise<boolean>;
    /** Places an attachment by value, as base64. The route for bytes with no path. */
    attachmentWrite(
        groupId: KissopenAgentGroupId,
        name: string,
        content: string,
    ): Promise<{ readonly path: string }>;
    terminalConnect(
        workspaceId: KissopenAgentGroupId,
        terminalId: KissopenAgentTerminalId,
    ): TerminalConnection;
}
