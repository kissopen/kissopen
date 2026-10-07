import { t } from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import { SCHEDULED_TASK_CREATE_TOOL } from "kissopen-desktop-state";
import type {
    ConversationActivity,
    ConversationActivityPresentation,
    ConversationActivityReview,
    ConversationActivityStatus,
    ConversationFileDiff,
    ConversationJson,
    ConversationScheduledTask,
    ConversationToolCall,
} from "kissopen-desktop-state";
import { compactCount, changeCountLabel } from "./countText";
import { CopyButton } from "./CopyButton";
import { DiffSnippet, type DiffLine } from "./DiffSnippet";
import { EventCard } from "./EventCard";
import { GeneratingImage } from "./GeneratingImage";
import { fileIsOfficeDocument, filePreviewKind } from "./FilePreview";
import { Icon, type IconName } from "./Icon";
import { useMessageListDisclosureAnchor } from "./messageListDisclosureAnchor";
import { renderMessageMarkdown } from "./MessageMarkdown";
import { scheduledTaskPlace, scheduledTaskTiming } from "./scheduledTaskText";
import { ScrollingText } from "./ScrollingText";
import { Spinner } from "./Spinner";
import { TypedText } from "./TypedText";
import { Ionicon, Octicon } from "./vectorIcons/VectorIcon";

/**
 * Which live labels type when their value changes. This affects animation
 * only: wording, timestamps, controls, and every other piece of row content
 * stay identical across profiles.
 */
export type ActivityMotion = "typewriter" | "verb-typed" | "calm-typed" | "calm";

/**
 * Content treatment independent of animation. `focused` keeps one action word
 * for the call's life, leaves copy metadata to the detail surface, and reveals
 * the tool's start time over the row's trailing edge.
 */
export type ActivityTreatment = "detailed" | "focused";

export type AgentActivityRowProps = {
    activity: ConversationActivity;
    /** Motion profile for live updates. Defaults to the historical `typewriter`. */
    motion?: ActivityMotion;
    /** Row content/chrome policy, independent of which labels animate. */
    treatment?: ActivityTreatment;
    /** Opens a tool's complete body in an owner-provided detail surface. */
    onToolSelect?: (tool: ConversationToolCall) => void;
    /**
     * Opens the workspace file a tool call worked on, in the product's file
     * viewer. A row whose tool names no single showable file offers nothing,
     * and a surface with no workspace behind it passes nothing.
     */
    onFileOpen?: (path: string) => void;
    /**
     * Opens Scheduled tasks with a task the assistant proposed already said.
     * A proposal is drawn as a card only where the surface can do this; without
     * it the call is an ordinary tool row, because a button that goes nowhere is
     * worse than a line that says what happened.
     */
    onScheduleProposalOpen?: (request: string) => void;
    /**
     * Opens Scheduled tasks at a task the agent created, by its ID. With it the
     * created-task card is a button that goes there; without it the card stays
     * a quiet confirmation, because nothing on this surface can show the task.
     */
    onScheduledTaskOpen?: (scheduleId: string) => void;
    /**
     * The computer this conversation runs on, by name, when it is not this
     * one. A scheduled task the agent created on "its" machine is said to run
     * there; absent, it is said to run on this computer.
     */
    scheduleMachineName?: string;
    /**
     * How far a running image generation is, 0–1, as the surface estimates it
     * from how long the call has run. Only an image-generation call still
     * running draws it; absent, such a call is an ordinary tool row.
     */
    imageProgress?: number;
    /** Opens a picture the agent made, larger. Absent, the picture is not a control. */
    onPictureOpen?: (picture: GeneratedPicture) => void;
    /** Start expanded (blueprint/tests). Otherwise rich bodies collapse by default. */
    defaultExpanded?: boolean;
    /** Controlled disclosure state for a virtualized transcript row. */
    expanded?: boolean;
    /** Reports disclosure changes so an owner can rebuild modeled row geometry. */
    onExpandedChange?: (expanded: boolean) => void;
    /**
     * Local conversation tool rows: one neutral line aligned with agent text, with
     * no inline result or expand affordance.
     */
    singleLine?: boolean;
    /** Durable event time, revealed with the row's trailing hover metadata. */
    time?: string;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

/** Max file diffs rendered per tool before an overflow note replaces the rest. */
const MAX_DIFF_FILES = 5;
/** Head/tail line budget for exec-command output before the middle is elided. */
const EXEC_HEAD_TAIL = 5;
/** Bounded JSON budget for generic tool-call arguments (chars). */
const JSON_BUDGET = 4096;
/** MCP result-row budget: dim child rows shown before an overflow note (A3). */
const MCP_RESULT_ROWS = 5;

function useExpansion(
    defaultExpanded: boolean,
    expanded: boolean | undefined,
    onExpandedChange: ((expanded: boolean) => void) | undefined,
) {
    const [ownExpanded, setOwnExpanded] = useState(defaultExpanded);
    const value = expanded ?? ownExpanded;
    return [
        value,
        (next: boolean) => {
            if (expanded === undefined) setOwnExpanded(next);
            onExpandedChange?.(next);
        },
    ] as const;
}

function AgentActivityTime(props: { time?: string }) {
    return props.time ? (
        <span
            className="kissopen-agent-activity__time"
            data-kissopen-desktop-ui="agent-activity-time"
        >
            {props.time}
        </span>
    ) : null;
}

/**
 * Parses an MCP tool name (`mcp__server__tool`) into its server and tool parts.
 * Returns undefined for any name that is not an MCP invocation, so the caller
 * falls back to the generic tool rendering path.
 */
function parseMcpToolName(name: string): { server: string; tool: string } | undefined {
    if (!name.startsWith("mcp__")) return undefined;
    const parts = name.split("__");
    if (parts.length < 3) return undefined;
    return { server: parts[1]!, tool: parts.slice(2).join(" ") };
}

/** Splits an MCP result into ≤`budget` dim rows, returning the overflow count. */
function mcpResultRows(display: string, budget: number): { rows: string[]; omitted: number } {
    const all = display.replace(/\n+$/, "").split("\n");
    if (all.length <= budget) return { rows: all, omitted: 0 };
    return { rows: all.slice(0, budget), omitted: all.length - budget };
}

/** Friendly tool label — mirrors the TUI `humanizeToolName` mapping (A3). */
function humanizeToolName(name: string): string {
    const explicit: Record<string, string> = {
        Agent: "Subagent",
        compact: "Context compaction",
        create_scheduled_task: t("创建定时任务"),
        propose_scheduled_task: t("提议定时任务"),
        TaskInput: "Terminal input",
        TaskList: "Task list",
        TaskOutput: "Background output",
        spawn_agent: "Start subagent",
        wait_agent: "Wait for subagents",
        workflow: "Workflow",
        write_stdin: "Terminal input",
    };
    if (explicit[name]) return explicit[name]!;
    if (name.startsWith("mcp__")) {
        const parts = name.split("__");
        if (parts.length >= 3) return `${parts[1]} · ${parts.slice(2).join(" ")}`;
    }
    return name
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (character) => character.toUpperCase());
}

/**
 * Tools that type into a terminal that is already running, rather than starting
 * one. Matched by name for the window before the result arrives, when the row
 * has no presentation to classify it by.
 */
const TERMINAL_INPUT_TOOL = /stdin|terminal_?input|taskinput/;

/** Active/done verb for a tool by name + status (A2/A3). */
function toolVerb(
    name: string,
    status: ConversationActivityStatus,
    presentation?: ConversationActivityPresentation,
): string {
    if (presentation?.type === "agentSpawn") {
        if (status === "awaitingApproval") return "Awaiting approval to spawn";
        if (status === "failed") return "Failed to spawn";
        if (status === "stopped") return "Stopped spawning";
        return status === "running" ? "Spawning" : "Spawned";
    }
    if (status === "awaitingApproval") return "Awaiting approval";
    if (status === "stopped") return "Stopped";
    const active = status === "running";
    const lower = name.toLowerCase();
    if (presentation?.type === "compaction") {
        return status === "failed" ? "Failed" : active ? "Compacting" : "Compacted";
    }
    if (presentation?.type === "search") return active ? "Searching" : "Searched";
    if (presentation?.type === "exploration") return active ? "Exploring" : "Explored";
    // Typing into a terminal that is already running is not the same act as
    // starting one, and it is certainly not editing a file: `write_stdin` would
    // otherwise fall through to the write/edit family below and claim to have
    // edited something called "Write stdin".
    if (presentation?.type === "backgroundTerminalInteraction" || TERMINAL_INPUT_TOOL.test(lower))
        return active ? "Typing" : "Typed";
    // Waiting ends when a child sends input. That expected wake-up is projected
    // as success; the verb describes the wait rather than a generic tool use.
    if (lower === "wait_agent") return active ? "Waiting" : "Waited";
    if (presentation?.type === "execCommand" || /(bash|exec|shell|command|run)/.test(lower))
        return "Bash";
    if (/(grep|find|glob|^ls$|list|search)/.test(lower)) return active ? "Exploring" : "Explored";
    if (/(read|view|cat|open)/.test(lower)) return active ? "Reading" : "Read";
    if (/(write|edit|patch|update|apply)/.test(lower)) return active ? "Editing" : "Edited";
    return active ? "Tool" : "Used";
}

/** Turns the lifecycle word into the stable action label used by focused rows. */
function toolVerbFocused(verb: string): string {
    switch (verb) {
        case "Exploring":
        case "Explored":
            return "Explore";
        case "Typing":
        case "Typed":
            return "Type";
        case "Reading":
            return "Read";
        case "Editing":
        case "Edited":
            return "Edit";
        case "Waiting":
        case "Waited":
            return "Wait";
        case "Used":
            return "Tool";
        default:
            return verb;
    }
}

/**
 * Tool → the glyph saying what kind of work it was. Commands use Octicons
 * `code`, failed tools use Octicons `alert`, and file edits use Ionicons
 * `document-outline`; the remaining tool families use the curated vocabulary.
 */
type ToolGlyph =
    | { set: "house"; name: IconName }
    | { set: "ionicons"; name: "document-outline" | "terminal-outline" }
    | { set: "octicons"; name: "alert" | "code" };

function toolGlyph(
    name: string,
    presentation: ConversationActivityPresentation | undefined,
    failed: boolean,
): ToolGlyph {
    if (failed) return { set: "octicons", name: "alert" };
    if (presentation?.type === "agentSpawn") return { set: "house", name: "agents" };
    if (presentation?.type === "compaction") return { set: "house", name: "filter" };
    if (presentation?.type === "search") return { set: "house", name: "globe" };
    if (presentation?.type === "exploration") return { set: "house", name: "search" };
    if (presentation?.type === "fileDiff") return { set: "ionicons", name: "document-outline" };
    if (
        presentation?.type === "scheduledTask" ||
        name === SCHEDULED_TASK_CREATE_TOOL ||
        name === SCHEDULE_PROPOSAL_TOOL
    )
        return { set: "house", name: "clock" };
    const lower = name.toLowerCase();
    // Typing into a running terminal gets the terminal itself, so it is not
    // mistaken for the command that started one or for a file edit.
    if (presentation?.type === "backgroundTerminalInteraction" || TERMINAL_INPUT_TOOL.test(lower))
        return { set: "ionicons", name: "terminal-outline" };
    if (presentation?.type === "execCommand") return { set: "octicons", name: "code" };
    if (/(bash|exec|shell|command|run)/.test(lower)) return { set: "octicons", name: "code" };
    if (/(grep|find|glob|^ls$|list|search)/.test(lower)) return { set: "house", name: "search" };
    if (/(read|view|cat|open)/.test(lower)) return { set: "house", name: "doc" };
    if (/(write|edit|patch|update|apply)/.test(lower))
        return { set: "ionicons", name: "document-outline" };
    if (/(fetch|http|web|url|browser)/.test(lower)) return { set: "house", name: "globe" };
    if (/(task|todo|plan)/.test(lower)) return { set: "house", name: "tasks" };
    if (/(agent|spawn|subagent|workflow)/.test(lower)) return { set: "house", name: "agents" };
    return { set: "house", name: "zap" };
}

function ToolIcon(props: { glyph: ToolGlyph }) {
    if (props.glyph.set === "ionicons") return <Ionicon name={props.glyph.name} size={12} />;
    if (props.glyph.set === "octicons") return <Octicon name={props.glyph.name} size={12} />;
    return <Icon name={props.glyph.name} size={12} />;
}

/**
 * Retypes a tool label whenever this row's projected text changes.
 *
 * `typeFirst` also types the text the label opens with. A subject only retypes
 * when it changes, and whether a command ever changes is decided by the wire —
 * arguments that streamed in arrive as several values and type, the same
 * command delivered whole arrives once and does not. Rows that are live when
 * they appear ask for the first value to type too, so the same act looks the
 * same either way.
 */
function AgentActivityChangingText(props: { value: string; typed?: boolean; typeFirst?: boolean }) {
    return (props.typed ?? true) ? (
        <TypedText
            data-kissopen-desktop-ui="agent-activity-changing-text"
            {...(props.typeFirst ? { typeInitial: true } : {})}
            value={props.value}
        />
    ) : (
        <span
            className="kissopen-agent-activity__still-text"
            data-kissopen-desktop-ui="agent-activity-changing-text"
        >
            {props.value}
        </span>
    );
}

function explorationSummary(
    presentation: Extract<ConversationActivityPresentation, { type: "exploration" }>,
): string {
    const operations = presentation.operations;
    if (operations.every((operation) => operation.kind === "read")) {
        return [
            ...new Set(
                operations.flatMap((operation) =>
                    operation.kind === "read" ? [operation.name] : [],
                ),
            ),
        ].join(", ");
    }
    return operations
        .map((operation) => {
            if (operation.kind === "list") return `List ${operation.target}`;
            if (operation.kind === "read") return `Read ${operation.name}`;
            const detail =
                operation.query !== undefined && operation.path !== undefined
                    ? `${operation.query} in ${operation.path}`
                    : (operation.query ?? operation.path ?? operation.command);
            return `Search ${detail}`;
        })
        .join(" · ");
}

function compactionSummary(
    presentation: Extract<ConversationActivityPresentation, { type: "compaction" }>,
): string {
    const before = presentation.tokensBefore;
    const after = presentation.tokensAfter;
    if (before === undefined) {
        return after === undefined ? "context" : `context to ${contextTokenCount(after)} tokens`;
    }
    return after === undefined
        ? `context from ${contextTokenCount(before)} tokens`
        : `context ${contextTokenCount(before)} → ${contextTokenCount(after)} tokens`;
}

/** Context occupancy keeps one useful decimal deeper into the thousands than a file count. */
function contextTokenCount(tokens: number): string {
    if (tokens < 1_000) return String(Math.max(0, Math.round(tokens)));
    const thousands = tokens / 1_000;
    return `${thousands < 100 ? thousands.toFixed(1).replace(/\.0$/, "") : String(Math.round(thousands))}k`;
}

/** Status → semantic dot tone: warning while active/awaiting, error on stop/fail. */
function statusTone(status: ConversationActivityStatus): "success" | "warning" | "error" {
    if (status === "success") return "success";
    if (status === "failed" || status === "stopped") return "error";
    return "warning";
}

function diffVerb(kind: ConversationFileDiff["kind"]): string {
    if (kind === "add") return "Added";
    if (kind === "delete") return "Deleted";
    return "Edit";
}

/**
 * What was typed into a terminal, on one line. Terminal input is mostly control
 * characters and newlines, which paint as nothing at all: an interrupt would
 * otherwise be an empty row. Control codes are shown the way a terminal echoes
 * them, and a multi-line paste keeps its first line with the rest counted.
 */
function terminalInputSummary(input: string): string {
    const visible = input
        .replaceAll("\r\n", "\n")
        .replace(/\n+$/, "")
        // eslint-disable-next-line no-control-regex -- Terminal input is exactly where control codes arrive, and they must be made visible rather than filtered out.
        .replaceAll(/[\u0000-\u001F\u007F]/g, (character) =>
            character === "\n"
                ? "\n"
                : `^${String.fromCharCode(character.charCodeAt(0) ^ 0x40).toUpperCase()}`,
        );
    if (visible.length === 0) return "";
    const lines = visible.split("\n");
    return lines.length > 1 ? `${lines[0]!} … +${String(lines.length - 1)} lines` : lines[0]!;
}

function fileName(path: string): string {
    const normalized = path.replaceAll("\\", "/");
    return normalized.slice(normalized.lastIndexOf("/") + 1) || path;
}

/** Argument names the file-reading and file-writing tools carry a path under. */
const FILE_PATH_ARGUMENTS = ["file_path", "filePath", "path", "notebook_path"] as const;

/**
 * The one workspace file a tool call is about, when it is about exactly one and
 * KISSOPEN can show it. A multi-file edit has no single answer, and a tool whose
 * subject is an archive or a binary would only open on "no preview", so both
 * report nothing rather than offering a click that goes nowhere.
 */
function toolFilePath(tool: ConversationToolCall): string | undefined {
    const presentation = tool.presentation;
    const candidate =
        presentation?.type === "fileDiff"
            ? presentation.files.length === 1
                ? presentation.files[0]!.path
                : undefined
            : argumentFilePath(tool.arguments);
    if (candidate === undefined || candidate.trim().length === 0) return undefined;
    // A document opens in the panel on its own "open in default app" notice.
    return filePreviewKind(candidate) === "binary" && !fileIsOfficeDocument(candidate)
        ? undefined
        : candidate;
}

function argumentFilePath(argumentsValue: ConversationToolCall["arguments"]): string | undefined {
    if (typeof argumentsValue !== "object" || argumentsValue === null) return undefined;
    if (Array.isArray(argumentsValue)) return undefined;
    for (const key of FILE_PATH_ARGUMENTS) {
        const value = (argumentsValue as Record<string, ConversationJson>)[key];
        if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return undefined;
}

function diffCounts(file: ConversationFileDiff): { added: number; deleted: number } {
    if (file.added !== undefined || file.deleted !== undefined)
        return { added: file.added ?? 0, deleted: file.deleted ?? 0 };
    let added = 0;
    let deleted = 0;
    for (const hunk of file.hunks)
        for (const line of hunk.lines) {
            if (line.kind === "add") added += 1;
            else if (line.kind === "delete") deleted += 1;
        }
    return { added, deleted };
}

/** Flattens a file's hunks into numbered DiffSnippet lines with `@@` meta rows. */
function diffLines(file: ConversationFileDiff): DiffLine[] {
    const lines: DiffLine[] = [];
    file.hunks.forEach((hunk, index) => {
        if (file.hunks.length > 1 || index > 0)
            lines.push({
                kind: "meta",
                text: `@@ -${hunk.oldStart} +${hunk.newStart} @@`,
            });
        let oldLine = hunk.oldStart;
        let newLine = hunk.newStart;
        for (const line of hunk.lines) {
            if (line.kind === "add") {
                lines.push({ kind: "add", number: newLine, text: line.text });
                newLine += 1;
            } else if (line.kind === "delete") {
                lines.push({ kind: "del", number: oldLine, text: line.text });
                oldLine += 1;
            } else {
                lines.push({ kind: "context", number: newLine, text: line.text });
                oldLine += 1;
                newLine += 1;
            }
        }
    });
    return lines;
}

/** Keep the first and last `budget` lines, eliding the middle with a count note. */
function headTail(text: string, budget: number): { lines: string[]; omitted: number } {
    const all = text.replace(/\n+$/, "").split("\n");
    if (all.length <= budget * 2) return { lines: all, omitted: 0 };
    return {
        lines: [...all.slice(0, budget), ...all.slice(all.length - budget)],
        omitted: all.length - budget * 2,
    };
}

/**
 * Whether a tool's arguments have anything to show, answered without
 * serializing them. A call still being generated grows its arguments with every
 * frame of the stream, and the row only asks this to decide whether it can be
 * opened at all — so the question is settled from the shape rather than from a
 * string the row is about to throw away.
 */
function jsonPresent(value: ConversationJson): boolean {
    if (value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
}

function boundedJson(value: ConversationJson): string | undefined {
    if (!jsonPresent(value)) return undefined;
    const text = JSON.stringify(value, null, 2);
    return text.length > JSON_BUDGET ? `${text.slice(0, JSON_BUDGET)}\n… truncated` : text;
}

function ChildRow(props: { tone?: "muted" | "error"; children: React.ReactNode }) {
    return (
        <div
            className="kissopen-agent-activity__child"
            data-tone={props.tone ?? "muted"}
            data-kissopen-desktop-ui="agent-activity-child"
        >
            <span aria-hidden="true" className="kissopen-agent-activity__child-marker">
                └
            </span>
            <span
                className="kissopen-agent-activity__child-text"
                data-kissopen-desktop-ui="agent-activity-child-text"
            >
                {props.children}
            </span>
        </div>
    );
}

function PermissionReviewRow(props: { review: ConversationActivityReview }) {
    const { review } = props;
    const title =
        review.decision === "allow"
            ? "Approved"
            : review.decision === "deny"
              ? "Denied"
              : "Awaiting approval";
    return (
        <div
            className="kissopen-agent-activity__review"
            data-kissopen-desktop-ui="agent-activity-review"
        >
            <span aria-hidden="true" className="kissopen-agent-activity__child-marker">
                └
            </span>
            <span className="kissopen-agent-activity__review-body">
                <span
                    className="kissopen-agent-activity__review-title"
                    data-kissopen-desktop-ui="agent-activity-review-title"
                >
                    {title} · {review.action}
                </span>
                <span className="kissopen-agent-activity__review-reason">{review.reason}</span>
                <span
                    className="kissopen-agent-activity__review-risk"
                    data-risk={review.risk}
                    data-kissopen-desktop-ui="agent-activity-review-risk"
                >
                    {t("Risk: {risk}", { risk: review.risk })}
                </span>
            </span>
        </div>
    );
}

/**
 * One tool invocation: a rich body chosen by `presentation` (file diff, exec
 * command, background-terminal interaction) with a generic header + result/args
 * fallback. A colored status dot and verb encode running/awaiting-approval/
 * success/failed/stopped, and a pending `review` renders an inline "Awaiting
 * approval" child line. Collapse/expand of the rich body is the only local UI
 * state; every value comes from props.
 */
function AgentToolActivity(props: {
    tool: ConversationToolCall;
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    motion?: ActivityMotion;
    treatment?: ActivityTreatment;
    onSelect?: (tool: ConversationToolCall) => void;
    onFileOpen?: (path: string) => void;
    singleLine?: boolean;
    time?: string;
}) {
    const { tool } = props;
    const presentation = tool.presentation;
    const [expanded, setExpanded] = useExpansion(
        props.defaultExpanded ?? false,
        props.expanded,
        props.onExpandedChange,
    );
    const singleLine = props.singleLine ?? false;
    const running = tool.status === "running";
    const motion = props.motion ?? "typewriter";
    const focused = props.treatment === "focused";
    const verbTyped = motion === "typewriter" || motion === "verb-typed";
    /** The subject types only in the profiles that type it. */
    const subjectTyped = motion === "typewriter" || motion === "calm-typed";

    const tone = singleLine ? "neutral" : statusTone(tool.status);

    // MCP tool calls (`mcp__server__tool`) have no protocol presentation; the TUI
    // derives their block at render time from the name, arguments, and result. We
    // do the same, but only when no richer presentation (diff/exec) applies.
    const mcp = presentation ? undefined : parseMcpToolName(tool.toolName);

    let primaryText: string;
    let stats: { added: number; deleted: number } | undefined;
    let verb: string;
    if (mcp) {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        primaryText = `${mcp.server} · ${mcp.tool}`;
    } else if (presentation?.type === "agentSpawn") {
        verb = toolVerb(tool.toolName, tool.failed ? "failed" : tool.status, presentation);
        primaryText = presentation.model ? `${presentation.model.name} sub-agent` : "sub-agent";
    } else if (presentation?.type === "compaction") {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        primaryText = compactionSummary(presentation);
    } else if (presentation?.type === "search") {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        primaryText = presentation.query;
    } else if (presentation?.type === "exploration") {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        primaryText = explorationSummary(presentation);
    } else if (presentation?.type === "fileDiff") {
        const first = presentation.files[0];
        verb = first ? diffVerb(first.kind) : toolVerb(tool.toolName, tool.status, presentation);
        primaryText = first ? fileName(first.path) : humanizeToolName(tool.toolName);
        stats = presentation.files.reduce(
            (total, file) => {
                const counts = diffCounts(file);
                return {
                    added: total.added + counts.added,
                    deleted: total.deleted + counts.deleted,
                };
            },
            { added: 0, deleted: 0 },
        );
    } else if (presentation?.type === "execCommand") {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        primaryText = presentation.command;
    } else if (presentation?.type === "backgroundTerminalInteraction") {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        // What was typed, not the command that started the terminal: several
        // interactions with one background task all carry the same command, so
        // showing that made a run of rows read as the same thing happening over
        // and over. The command is context, and it moves into the body below.
        primaryText = terminalInputSummary(presentation.input) || presentation.command;
    } else if (
        tool.toolName === SCHEDULED_TASK_CREATE_TOOL ||
        tool.toolName === SCHEDULE_PROPOSAL_TOOL
    ) {
        ({ verb, primaryText } = scheduledTaskRowText(tool));
    } else {
        verb = toolVerb(tool.toolName, tool.status, presentation);
        primaryText =
            tool.toolName.toLowerCase() === "wait_agent"
                ? "for subagents"
                : humanizeToolName(tool.toolName);
    }
    if (focused && presentation?.type !== "fileDiff") verb = toolVerbFocused(verb);
    /* Ran outside the sandbox. Said in colour alone — the whole line turns
       amber — because a word in the verb would push the command itself out of
       a row that is already short. A call that stopped or failed never got
       that far, and its own status is the louder fact. */
    const elevated =
        tool.elevated === true &&
        tool.status !== "stopped" &&
        tool.status !== "failed" &&
        !tool.failed;
    const filePath = props.onFileOpen ? toolFilePath(tool) : undefined;

    /* Only a row that is open, and open on its arguments, ever prints them.
       Serializing them anyway cost the whole argument tree on every frame of a
       call still being generated — for a transcript row that never shows a body
       at all, and for a closed row nobody has asked to see. */
    const argsPresent = presentation === undefined && jsonPresent(tool.arguments);
    const execOutput =
        presentation?.type === "execCommand"
            ? headTail(presentation.output, EXEC_HEAD_TAIL)
            : undefined;
    const terminalInput =
        presentation?.type === "backgroundTerminalInteraction"
            ? presentation.input.replace(/\n+$/, "").split("\n")
            : undefined;
    const compactionFailure =
        presentation?.type === "compaction" ? presentation.failureReason : undefined;

    /* What a reader reaches for the clipboard to get: the subject that scrolled
       out of the row, followed by the output or result the row only shows in
       part. Both are elided on screen, so the copy is the unabridged text. */
    const copyText = [
        primaryText,
        presentation?.type === "execCommand"
            ? presentation.output
            : presentation?.type === "search"
              ? presentation.sources?.map((source) => `${source.title}\n${source.url}`).join("\n")
              : presentation?.type === "compaction"
                ? presentation.failureReason
                : presentation === undefined
                  ? tool.display
                  : undefined,
    ]
        .map((part) => part?.replace(/\n+$/, ""))
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join("\n");

    const hasBody = singleLine
        ? false
        : presentation?.type === "fileDiff"
          ? presentation.files.length > 0
          : presentation?.type === "search"
            ? (presentation.sources?.length ?? 0) > 0
            : presentation?.type === "execCommand"
              ? presentation.output.trim().length > 0
              : presentation?.type === "backgroundTerminalInteraction"
                ? presentation.input.trim().length > 0
                : argsPresent;

    // MCP results render as capped dim rows (≤5, then "… N more"); an interrupted
    // call collapses to a single "Interrupted." row, matching the TUI.
    const mcpResult = mcp
        ? tool.failure?.kind === "interrupted"
            ? { rows: ["Interrupted."], omitted: 0 }
            : tool.display && tool.display.trim().length > 0
              ? mcpResultRows(tool.display, MCP_RESULT_ROWS)
              : { rows: ["(empty result)"], omitted: 0 }
        : undefined;

    const genericResult =
        mcp || presentation
            ? undefined
            : tool.display !== undefined && tool.display.length > 0
              ? tool.display
              : "(empty result)";

    const header = (
        <>
            {singleLine ? null : (
                <span
                    aria-hidden="true"
                    className="kissopen-agent-activity__dot"
                    data-tone={tone}
                    data-kissopen-desktop-ui="agent-activity-dot"
                />
            )}
            {/* What kind of work this was, told at a glance. It is decoration
                over the verb beside it, which already says the same thing in
                words, so it stays out of the accessibility tree. */}
            <span
                aria-hidden="true"
                className="kissopen-agent-activity__glyph"
                data-kissopen-desktop-ui="agent-activity-glyph"
            >
                {running ? (
                    <Spinner
                        label={t("{tool} is running", { tool: humanizeToolName(tool.toolName) })}
                        size={12}
                        tone="muted"
                        variant="circle"
                    />
                ) : (
                    <ToolIcon
                        glyph={toolGlyph(
                            tool.toolName,
                            presentation,
                            tool.failed ||
                                tool.status === "failed" ||
                                (presentation?.type === "scheduledTask" &&
                                    presentation.outcome.status === "failed"),
                        )}
                    />
                )}
            </span>
            <span
                className="kissopen-agent-activity__verb"
                data-kissopen-desktop-ui="agent-activity-verb"
            >
                <AgentActivityChangingText typed={verbTyped} value={verb} />
            </span>
            {stats ? (
                <span
                    className="kissopen-agent-activity__file-summary"
                    data-kissopen-desktop-ui="agent-activity-file-summary"
                >
                    <ScrollingText
                        className="kissopen-agent-activity__text"
                        data-kissopen-desktop-ui="agent-activity-text"
                    >
                        <AgentActivityChangingText
                            typeFirst={running}
                            typed={subjectTyped}
                            value={primaryText}
                        />
                    </ScrollingText>
                    {/* A side that changed nothing is left unsaid: "+0" is a
                        number the reader has to read before learning there was
                        nothing to learn. */}
                    {stats.added || stats.deleted ? (
                        <span
                            className="kissopen-agent-activity__stats"
                            data-kissopen-desktop-ui="agent-activity-stats"
                        >
                            {stats.added ? (
                                <span aria-hidden="true" className="kissopen-agent-activity__added">
                                    +{compactCount(stats.added)}
                                </span>
                            ) : null}
                            {stats.deleted ? (
                                <span
                                    aria-hidden="true"
                                    className="kissopen-agent-activity__deleted"
                                >
                                    &minus;{compactCount(stats.deleted)}
                                </span>
                            ) : null}
                            <span className="kissopen-visually-hidden">
                                {changeCountLabel(stats.added ?? 0, stats.deleted ?? 0)}
                            </span>
                        </span>
                    ) : null}
                </span>
            ) : (
                <ScrollingText
                    className="kissopen-agent-activity__text"
                    data-kissopen-desktop-ui="agent-activity-text"
                >
                    <AgentActivityChangingText
                        typeFirst={running}
                        typed={subjectTyped}
                        value={primaryText}
                    />
                </ScrollingText>
            )}
            {hasBody ? (
                <span aria-hidden="true" className="kissopen-agent-activity__chevron">
                    <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
                </span>
            ) : null}
            <AgentActivityTime time={props.time} />
        </>
    );

    // `data-review` marks a call that went through a permission review, and
    // `data-elevated` the reviewed call that then ran with temporary Full
    // access. Both sit on the row rather than on the review line so the mark
    // survives the single-line variant, where that line is cut.
    return (
        <div
            className="kissopen-agent-activity"
            data-status={tool.status}
            data-failed={tool.failed || tool.status === "failed" ? "" : undefined}
            data-tone={tone}
            data-presentation={presentation?.type ?? "generic"}
            data-review={tool.review ? "" : undefined}
            data-elevated={elevated ? "" : undefined}
            data-single-line={singleLine ? "" : undefined}
            data-expanded={expanded ? "" : undefined}
            data-kissopen-desktop-ui="agent-activity-call"
        >
            {/* The copy action is a sibling of the header rather than part of
                it: the header is itself a button in most variants, and a
                nested button would be neither valid nor clickable. */}
            <div
                className="kissopen-agent-activity__line"
                data-kissopen-desktop-ui="agent-activity-line"
            >
                {singleLine && props.onSelect ? (
                    <button
                        className="kissopen-agent-activity__header"
                        data-kissopen-desktop-ui="agent-activity-header"
                        onClick={() => props.onSelect?.(tool)}
                        type="button"
                    >
                        {header}
                    </button>
                ) : singleLine ? (
                    <div
                        className="kissopen-agent-activity__header"
                        data-kissopen-desktop-ui="agent-activity-header"
                    >
                        {header}
                    </div>
                ) : (
                    <button
                        aria-expanded={hasBody ? (expanded ? "true" : "false") : undefined}
                        className="kissopen-agent-activity__header"
                        data-kissopen-desktop-ui="agent-activity-header"
                        disabled={!hasBody}
                        onClick={() => hasBody && setExpanded(!expanded)}
                        type="button"
                    >
                        {header}
                    </button>
                )}
                {filePath !== undefined && props.onFileOpen ? (
                    /* A sibling of the header for the same reason the copy
                       action is one: the header is itself a button in every
                       variant that opens something. */
                    <button
                        aria-label={t("Open {name}", { name: fileName(filePath) })}
                        className="kissopen-agent-activity__open"
                        data-kissopen-desktop-ui="agent-activity-open"
                        data-path={filePath}
                        onClick={(event) => {
                            event.stopPropagation();
                            props.onFileOpen?.(filePath);
                        }}
                        type="button"
                    >
                        <Icon name="eye" size={14} />
                    </button>
                ) : null}
                {focused ? null : (
                    <CopyButton
                        data-kissopen-desktop-ui="agent-activity-copy"
                        label={t("Copy tool detail")}
                        text={copyText}
                    />
                )}
            </div>

            {!singleLine && tool.review ? <PermissionReviewRow review={tool.review} /> : null}

            {!singleLine && genericResult !== undefined ? (
                <ChildRow tone={tool.failed ? "error" : "muted"}>{genericResult}</ChildRow>
            ) : null}

            {!singleLine && compactionFailure !== undefined ? (
                <ChildRow tone="error">{compactionFailure}</ChildRow>
            ) : null}

            {!singleLine && mcpResult ? (
                <div data-kissopen-desktop-ui="agent-activity-mcp-result">
                    {mcpResult.rows.map((row, index) => (
                        <ChildRow key={index} tone={tool.failed ? "error" : "muted"}>
                            {row || "\u00a0"}
                        </ChildRow>
                    ))}
                    {mcpResult.omitted > 0 ? (
                        <ChildRow>{t("… {count} more", { count: mcpResult.omitted })}</ChildRow>
                    ) : null}
                </div>
            ) : null}

            {expanded && hasBody ? (
                <div
                    className="kissopen-agent-activity__body"
                    data-kissopen-desktop-ui="agent-activity-body"
                >
                    {presentation?.type === "fileDiff"
                        ? (() => {
                              const shown = presentation.files.slice(0, MAX_DIFF_FILES);
                              const omittedFiles =
                                  (presentation.omittedFiles ?? 0) +
                                  Math.max(0, presentation.files.length - MAX_DIFF_FILES);
                              return (
                                  <>
                                      {shown.map((file, index) => (
                                          <div
                                              className="kissopen-agent-activity__diff"
                                              key={`${file.path}-${index}`}
                                          >
                                              <DiffSnippet
                                                  file={file.path}
                                                  lines={diffLines(file)}
                                                  stats={{
                                                      added: diffCounts(file).added,
                                                      removed: diffCounts(file).deleted,
                                                  }}
                                              />
                                              {file.omittedLines ? (
                                                  <ChildRow>
                                                      {t("… {count} more lines", {
                                                          count: file.omittedLines,
                                                      })}
                                                  </ChildRow>
                                              ) : null}
                                          </div>
                                      ))}
                                      {omittedFiles > 0 ? (
                                          <ChildRow>
                                              {t("… {count} more files", { count: omittedFiles })}
                                          </ChildRow>
                                      ) : null}
                                  </>
                              );
                          })()
                        : null}

                    {presentation?.type === "execCommand" && execOutput
                        ? (() => {
                              const headCount =
                                  execOutput.omitted > 0 ? EXEC_HEAD_TAIL : execOutput.lines.length;
                              return (
                                  <pre
                                      className="kissopen-agent-activity__output"
                                      data-kissopen-desktop-ui="agent-activity-output"
                                  >
                                      {execOutput.lines.map((line, index) => (
                                          <div
                                              className="kissopen-agent-activity__output-line"
                                              key={index}
                                          >
                                              {line || "\u00a0"}
                                              {execOutput.omitted > 0 && index === headCount - 1 ? (
                                                  <div className="kissopen-agent-activity__output-elide">
                                                      {t("… +{count} lines", {
                                                          count: execOutput.omitted,
                                                      })}
                                                  </div>
                                              ) : null}
                                          </div>
                                      ))}
                                  </pre>
                              );
                          })()
                        : null}

                    {terminalInput ? (
                        <div className="kissopen-agent-activity__terminal">
                            {terminalInput.map((line, index) => (
                                <ChildRow key={index}>{line || "\u00a0"}</ChildRow>
                            ))}
                        </div>
                    ) : null}

                    {presentation?.type === "search"
                        ? presentation.sources?.map((source) => (
                              <ChildRow key={source.url}>
                                  <a
                                      className="kissopen-agent-activity__source"
                                      href={source.url}
                                      rel="noreferrer"
                                      target="_blank"
                                  >
                                      {source.title || source.url}
                                  </a>
                              </ChildRow>
                          ))
                        : null}

                    {argsPresent ? (
                        <pre
                            className="kissopen-agent-activity__args"
                            data-kissopen-desktop-ui="agent-activity-args"
                        >
                            {boundedJson(tool.arguments)}
                        </pre>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

/** Model reasoning: one compact line that expands into the full thinking text. */
function AgentReasoningActivity(props: {
    text: string;
    streaming: boolean;
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    time?: string;
}) {
    const [expanded, setExpanded] = useExpansion(
        props.defaultExpanded ?? false,
        props.expanded,
        props.onExpandedChange,
    );
    const summary = props.text.split("\n").find((line) => line.trim().length > 0) ?? "";
    return (
        <div
            className="kissopen-agent-activity"
            data-expanded={expanded ? "" : undefined}
            data-presentation="reasoning"
            data-tone="warning"
            data-kissopen-desktop-ui="agent-activity-reasoning"
        >
            <button
                aria-expanded={expanded ? "true" : "false"}
                className="kissopen-agent-activity__header"
                data-kissopen-desktop-ui="agent-activity-header"
                onClick={() => setExpanded(!expanded)}
                type="button"
            >
                <span
                    aria-hidden="true"
                    className="kissopen-agent-activity__dot"
                    data-tone={props.streaming ? "warning" : "success"}
                    data-kissopen-desktop-ui="agent-activity-dot"
                />
                <span
                    className="kissopen-agent-activity__verb"
                    data-kissopen-desktop-ui="agent-activity-verb"
                >
                    {props.streaming ? "Thinking" : "Thought"}
                </span>
                <ScrollingText
                    className="kissopen-agent-activity__text"
                    data-kissopen-desktop-ui="agent-activity-text"
                >
                    {summary}
                </ScrollingText>
                <span aria-hidden="true" className="kissopen-agent-activity__chevron">
                    <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
                </span>
                <AgentActivityTime time={props.time} />
            </button>
            {expanded ? (
                <div
                    className="kissopen-agent-activity__body kissopen-agent-activity__reasoning kissopen-message__body--markdown"
                    data-kissopen-desktop-ui="agent-activity-reasoning-body"
                >
                    {renderMessageMarkdown(props.text)}
                </div>
            ) : null}
        </div>
    );
}

/**
 * A message one agent sent another: who it came from on the row, and the
 * message itself behind it. The addressing envelope Kissopen Agent wrote for the
 * receiving model is part of the text and is shown with it rather than trimmed.
 */
function AgentMessageActivity(props: {
    agentId: string;
    agentName?: string;
    text: string;
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    time?: string;
}) {
    const [expanded, setExpanded] = useExpansion(
        props.defaultExpanded ?? false,
        props.expanded,
        props.onExpandedChange,
    );
    const disclosureAnchor = useMessageListDisclosureAnchor();
    const hasBody = props.text.trim().length > 0;
    return (
        <div
            className="kissopen-agent-activity"
            data-expanded={expanded ? "" : undefined}
            data-presentation="agent-message"
            data-tone="neutral"
            data-kissopen-desktop-ui="agent-activity-message"
        >
            <button
                aria-expanded={hasBody ? (expanded ? "true" : "false") : undefined}
                className="kissopen-agent-activity__header"
                data-kissopen-desktop-ui="agent-activity-header"
                disabled={!hasBody}
                onClick={(event) => {
                    if (!hasBody) return;
                    disclosureAnchor?.(event.currentTarget);
                    setExpanded(!expanded);
                }}
                type="button"
            >
                <span
                    aria-hidden="true"
                    className="kissopen-agent-activity__glyph"
                    data-kissopen-desktop-ui="agent-activity-glyph"
                >
                    <Icon name="agents" size={12} />
                </span>
                <span
                    className="kissopen-agent-activity__verb"
                    data-kissopen-desktop-ui="agent-activity-verb"
                >
                    {t("Message")}
                </span>
                <ScrollingText
                    className="kissopen-agent-activity__text"
                    data-kissopen-desktop-ui="agent-activity-text"
                >
                    {t("from {name}", { name: props.agentName ?? props.agentId })}
                </ScrollingText>
                {hasBody ? (
                    <span aria-hidden="true" className="kissopen-agent-activity__chevron">
                        <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
                    </span>
                ) : null}
                <AgentActivityTime time={props.time} />
            </button>
            {expanded && hasBody ? (
                <div
                    className="kissopen-agent-activity__body kissopen-agent-activity__message kissopen-message__body--markdown"
                    data-kissopen-desktop-ui="agent-activity-message-body"
                >
                    {renderMessageMarkdown(props.text)}
                </div>
            ) : null}
        </div>
    );
}

/** A shell-mode run: the command line, its exit state, and its captured output. */
function AgentShellActivity(props: {
    command: string;
    output: string;
    exitCode: number | null;
    running: boolean;
    timedOut: boolean;
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    time?: string;
}) {
    const [expanded, setExpanded] = useExpansion(
        props.defaultExpanded ?? true,
        props.expanded,
        props.onExpandedChange,
    );
    const failed = !props.running && (props.timedOut || (props.exitCode ?? 0) !== 0);
    const status = props.running
        ? "Running"
        : props.timedOut
          ? "Timed out"
          : `Exit ${props.exitCode ?? "?"}`;
    const hasBody = props.output.trim().length > 0;
    return (
        <div
            className="kissopen-agent-activity"
            data-expanded={expanded ? "" : undefined}
            data-presentation="shell"
            data-tone={props.running ? "warning" : failed ? "error" : "success"}
            data-kissopen-desktop-ui="agent-activity-shell"
        >
            <button
                aria-expanded={hasBody ? (expanded ? "true" : "false") : undefined}
                className="kissopen-agent-activity__header"
                data-kissopen-desktop-ui="agent-activity-header"
                disabled={!hasBody}
                onClick={() => hasBody && setExpanded(!expanded)}
                type="button"
            >
                <span
                    aria-hidden="true"
                    className="kissopen-agent-activity__dot"
                    data-tone={props.running ? "warning" : failed ? "error" : "success"}
                    data-kissopen-desktop-ui="agent-activity-dot"
                />
                <span
                    aria-hidden="true"
                    className="kissopen-agent-activity__glyph"
                    data-kissopen-desktop-ui="agent-activity-glyph"
                >
                    {failed ? (
                        <Octicon name="alert" size={12} />
                    ) : (
                        <Octicon name="code" size={12} />
                    )}
                </span>
                <span
                    className="kissopen-agent-activity__verb"
                    data-kissopen-desktop-ui="agent-activity-verb"
                >
                    {t("Bash")}
                </span>
                <ScrollingText
                    className="kissopen-agent-activity__text"
                    data-kissopen-desktop-ui="agent-activity-text"
                >
                    {props.command}
                </ScrollingText>
                <span
                    className="kissopen-agent-activity__status"
                    data-failed={failed ? "true" : undefined}
                    data-kissopen-desktop-ui="agent-activity-status"
                >
                    {status}
                </span>
                {hasBody ? (
                    <span aria-hidden="true" className="kissopen-agent-activity__chevron">
                        <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
                    </span>
                ) : null}
                <AgentActivityTime time={props.time} />
            </button>
            {expanded && hasBody ? (
                <div
                    className="kissopen-agent-activity__body"
                    data-kissopen-desktop-ui="agent-activity-body"
                >
                    <pre
                        className="kissopen-agent-activity__output"
                        data-kissopen-desktop-ui="agent-activity-output"
                    >
                        {props.output}
                    </pre>
                </div>
            ) : null}
        </div>
    );
}

/**
 * A step the producer already described: its label and subject go straight to
 * the same single line a live tool call renders, so summarized and streamed
 * activity read identically.
 */
function AgentLabeledActivity(props: {
    label: string;
    subject?: string;
    status: ConversationActivityStatus;
    mono: boolean;
    time?: string;
}) {
    return (
        <div
            className="kissopen-agent-activity"
            data-kissopen-desktop-ui="agent-activity-call"
            data-mono={props.mono ? "" : undefined}
            data-single-line=""
            data-status={props.status}
            data-tone="neutral"
        >
            <div
                className="kissopen-agent-activity__header"
                data-kissopen-desktop-ui="agent-activity-header"
            >
                <span
                    className="kissopen-agent-activity__verb"
                    data-kissopen-desktop-ui="agent-activity-verb"
                >
                    <AgentActivityChangingText value={props.label} />
                </span>
                {props.subject !== undefined && props.subject.length > 0 ? (
                    <ScrollingText
                        className="kissopen-agent-activity__text"
                        data-kissopen-desktop-ui="agent-activity-text"
                    >
                        <AgentActivityChangingText value={props.subject} />
                    </ScrollingText>
                ) : null}
                <AgentActivityTime time={props.time} />
            </div>
        </div>
    );
}

/**
 * AgentActivityRow — the one glanceable row for everything an agent does inside
 * a conversation: a tool call, a reasoning block, a shell run, or a message
 * another agent sent it. Each variant shows its mark, a verb, and its subject on
 * a single line and expands to the detail on demand, so a long working turn
 * stays readable without hiding what happened. Presentational only: the caller
 * supplies the projected activity and the surface decides which rows to show at
 * all.
 */
export function AgentActivityRow(props: AgentActivityRowProps) {
    const activity = props.activity;
    return (
        <div
            className={["kissopen-agent-activity-row", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="agent-activity-row"
            data-kind={activity.kind}
            data-treatment={props.treatment ?? "detailed"}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {activity.kind === "tool" && activity.tool.presentation?.type === "imageGeneration" ? (
                <div className="kissopen-agent-activity__card">
                    <GeneratedImageActivity
                        picture={activity.tool.presentation}
                        {...(props.onPictureOpen ? { onOpen: props.onPictureOpen } : {})}
                    />
                </div>
            ) : activity.kind === "tool" &&
              props.imageProgress !== undefined &&
              isImageGenerationTool(activity.tool) &&
              activity.tool.status === "running" ? (
                <div className="kissopen-agent-activity__card">
                    <GeneratingImage
                        height={IMAGE_ROW_SIDE}
                        label={`${Math.round(props.imageProgress * 100)}%`}
                        progress={props.imageProgress}
                        width={IMAGE_ROW_SIDE}
                    />
                </div>
            ) : activity.kind === "tool" && scheduledTaskCreated(activity.tool) !== undefined ? (
                <div className="kissopen-agent-activity__card">
                    <ScheduledTaskCreatedActivity
                        {...(props.scheduleMachineName === undefined
                            ? {}
                            : { machineName: props.scheduleMachineName })}
                        {...(props.onScheduledTaskOpen
                            ? { onOpen: props.onScheduledTaskOpen }
                            : {})}
                        schedule={scheduledTaskCreated(activity.tool)!}
                    />
                </div>
            ) : activity.kind === "tool" &&
              props.onScheduleProposalOpen &&
              scheduleProposalRequest(activity.tool) !== undefined ? (
                <div className="kissopen-agent-activity__card">
                    <ScheduleProposalActivity
                        onOpen={props.onScheduleProposalOpen}
                        request={scheduleProposalRequest(activity.tool)!}
                    />
                </div>
            ) : activity.kind === "tool" ? (
                <AgentToolActivity
                    defaultExpanded={props.defaultExpanded}
                    expanded={props.expanded}
                    motion={props.motion}
                    onExpandedChange={props.onExpandedChange}
                    treatment={props.treatment}
                    onSelect={props.onToolSelect}
                    {...(props.onFileOpen ? { onFileOpen: props.onFileOpen } : {})}
                    singleLine={props.singleLine}
                    time={props.time}
                    tool={activity.tool}
                />
            ) : activity.kind === "labeled" ? (
                <AgentLabeledActivity
                    label={activity.label}
                    mono={activity.mono}
                    status={activity.status}
                    subject={activity.subject}
                    time={props.time}
                />
            ) : activity.kind === "agentMessage" ? (
                <AgentMessageActivity
                    agentId={activity.agentId}
                    {...(activity.agentName === undefined ? {} : { agentName: activity.agentName })}
                    defaultExpanded={props.defaultExpanded}
                    expanded={props.expanded}
                    onExpandedChange={props.onExpandedChange}
                    text={activity.text}
                    time={props.time}
                />
            ) : activity.kind === "reasoning" ? (
                <AgentReasoningActivity
                    defaultExpanded={props.defaultExpanded}
                    expanded={props.expanded}
                    onExpandedChange={props.onExpandedChange}
                    streaming={activity.streaming}
                    text={activity.text}
                    time={props.time}
                />
            ) : (
                <AgentShellActivity
                    command={activity.command}
                    defaultExpanded={props.defaultExpanded}
                    expanded={props.expanded}
                    exitCode={activity.exitCode}
                    onExpandedChange={props.onExpandedChange}
                    output={activity.output}
                    running={activity.running}
                    timedOut={activity.timedOut}
                    time={props.time}
                />
            )}
        </div>
    );
}

/** The assistant's tool for handing a task to Scheduled tasks. */
const SCHEDULE_PROPOSAL_TOOL = "propose_scheduled_task";
/** The `EventCard` a proposal is drawn as; mirrors `styles/event-card.css`. */
export const SCHEDULE_PROPOSAL_CARD_HEIGHT = 44;
/** Vertical chrome `.kissopen-agent-activity__card` adds around any of these cards. */
export const ACTIVITY_CARD_CHROME = 12;

/**
 * The one sentence a scheduled-task proposal carries, if this call is one.
 *
 * Named by the tool's own contract — `propose_scheduled_task` with a `request`
 * — rather than guessed from what the call looks like.
 */
export function scheduleProposalRequest(tool: ConversationToolCall): string | undefined {
    if (tool.toolName !== SCHEDULE_PROPOSAL_TOOL || tool.failed) return undefined;
    const request = (tool.arguments as { readonly request?: unknown } | undefined)?.request;
    return typeof request === "string" && request.trim() ? request.trim() : undefined;
}

/**
 * A task the assistant proposed, waiting for the reader.
 *
 * The assistant cannot schedule anything; it does not know where a task could
 * run, and a plan that existed before the reader had read it is what Scheduled
 * tasks exists to prevent. So the proposal is a card, and choosing it opens
 * Scheduled tasks with the request already said, where the timing is settled
 * and nothing exists until the reader confirms.
 */
function ScheduleProposalActivity(props: {
    readonly request: string;
    readonly onOpen: (request: string) => void;
}) {
    return (
        <EventCard
            icon="clock"
            meta={t("Set it up in Schedules to confirm")}
            onSelect={() => props.onOpen(props.request)}
            title={props.request}
        />
    );
}

/** The card a created scheduled task is drawn as; mirrors `styles/agent-activity-row.css`. */
export const SCHEDULED_TASK_CARD_HEIGHT = 56;

/**
 * The task a `create_scheduled_task` call created, if this call is one that
 * did. Read from the call's typed presentation, never from its text.
 */
export function scheduledTaskCreated(
    tool: ConversationToolCall,
): ConversationScheduledTask | undefined {
    const presentation = tool.presentation;
    return presentation?.type === "scheduledTask" && presentation.outcome.status === "created"
        ? presentation.outcome.schedule
        : undefined;
}

/**
 * The one line a scheduled-task call says when it is not a card: creating one,
 * a time still to settle, a failure, or a proposal on a surface that cannot
 * open Scheduled tasks. Always in words, never the tool's own name.
 */
function scheduledTaskRowText(tool: ConversationToolCall): { verb: string; primaryText: string } {
    const argument = (tool.arguments as { readonly request?: unknown } | undefined)?.request;
    const request = typeof argument === "string" ? argument.trim() : "";
    if (tool.toolName === SCHEDULE_PROPOSAL_TOOL)
        return { verb: t("提议定时任务"), primaryText: request };
    const outcome =
        tool.presentation?.type === "scheduledTask" ? tool.presentation.outcome : undefined;
    if (outcome?.status === "created")
        return { verb: t("已创建定时任务"), primaryText: outcome.schedule.name };
    if (outcome?.status === "needs")
        return { verb: t("定时任务还需确认时间"), primaryText: request };
    if (outcome?.status === "failed")
        return { verb: t("未能创建定时任务"), primaryText: outcome.error || request };
    switch (tool.status) {
        case "running":
            return { verb: t("正在创建定时任务"), primaryText: request };
        case "awaitingApproval":
            return { verb: t("等待批准创建定时任务"), primaryText: request };
        case "stopped":
            return { verb: t("已停止创建定时任务"), primaryText: request };
        case "failed":
            return {
                verb: t("未能创建定时任务"),
                primaryText: tool.display?.trim() || request,
            };
        case "success":
            return {
                verb: tool.failed ? t("未能创建定时任务") : t("创建定时任务"),
                primaryText: request,
            };
    }
}

/**
 * A task the agent created, on the server, as the reader asked. Nothing is
 * left to confirm: the card says what now runs, when, and where. Scheduled
 * tasks is where it is changed, so where the surface can go there the whole
 * card is a button that opens it at this task; elsewhere it is not a control.
 */
function ScheduledTaskCreatedActivity(props: {
    readonly schedule: ConversationScheduledTask;
    readonly machineName?: string;
    readonly onOpen?: (scheduleId: string) => void;
}) {
    const { schedule, onOpen } = props;
    const content = (
        <>
            <span
                className="kissopen-agent-activity__schedule-chip"
                data-kissopen-desktop-ui="agent-activity-schedule-chip"
            >
                <Icon name="clock" size={16} />
            </span>
            <span
                className="kissopen-agent-activity__schedule-text"
                data-kissopen-desktop-ui="agent-activity-schedule-text"
            >
                <span
                    className="kissopen-agent-activity__schedule-title"
                    data-kissopen-desktop-ui="agent-activity-schedule-title"
                >
                    {t("已创建定时任务")}
                </span>
                <span
                    className="kissopen-agent-activity__schedule-detail"
                    data-kissopen-desktop-ui="agent-activity-schedule-detail"
                >
                    <span
                        className="kissopen-agent-activity__schedule-name"
                        data-kissopen-desktop-ui="agent-activity-schedule-name"
                        title={schedule.instruction || schedule.name}
                    >
                        {schedule.name}
                    </span>
                    <span
                        className="kissopen-agent-activity__schedule-facts"
                        data-kissopen-desktop-ui="agent-activity-schedule-facts"
                    >
                        {`· ${scheduledTaskTiming(schedule)} · ${scheduledTaskPlace(schedule, props.machineName)}`}
                    </span>
                </span>
            </span>
        </>
    );
    return onOpen ? (
        <button
            aria-label={t("打开定时任务：{name}", { name: schedule.name })}
            className="kissopen-agent-activity__schedule"
            data-clickable=""
            data-kissopen-desktop-ui="agent-activity-schedule"
            data-schedule-id={schedule.id}
            onClick={() => onOpen(schedule.id)}
            type="button"
        >
            {content}
            <span
                aria-hidden="true"
                className="kissopen-agent-activity__schedule-open"
                data-kissopen-desktop-ui="agent-activity-schedule-open"
            >
                <Icon name="chevron-right" size={14} />
            </span>
        </button>
    ) : (
        <div
            className="kissopen-agent-activity__schedule"
            data-kissopen-desktop-ui="agent-activity-schedule"
            data-schedule-id={schedule.id}
        >
            {content}
        </div>
    );
}

/** The tools that generate a picture, by the names the agent gives them. */
const IMAGE_GENERATION_TOOLS: ReadonlySet<string> = new Set(["codex_imagegen", "gemini_imagegen"]);
/** The square a picture on its way occupies, and the longest side of one that arrived. */
export const IMAGE_ROW_SIDE = 320;

/** The height a finished picture takes in a row: its own aspect at the row's side. */
export function generatedImageRowHeight(picture: {
    readonly width: number;
    readonly height: number;
}): number {
    const scale = IMAGE_ROW_SIDE / Math.max(picture.width, picture.height);
    return Math.max(1, Math.round(picture.height * scale));
}

export function isImageGenerationTool(tool: ConversationToolCall): boolean {
    return IMAGE_GENERATION_TOOLS.has(tool.toolName);
}

/**
 * A picture the agent made, shown where the wait for it was.
 *
 * The preview travels with the result, so it is drawn at once and sized from
 * the picture's own dimensions rather than reflowing when it loads. It takes
 * the same width the halftone field held, which is what keeps the row from
 * jumping when the picture arrives.
 */
/** One picture an image-generation call made, as the transcript carries it. */
export type GeneratedPicture = Extract<
    NonNullable<ConversationToolCall["presentation"]>,
    { type: "imageGeneration" }
>;

function GeneratedImageActivity(props: {
    readonly picture: GeneratedPicture;
    readonly onOpen?: (picture: GeneratedPicture) => void;
}) {
    const { picture } = props;
    const scale = IMAGE_ROW_SIDE / Math.max(picture.width, picture.height);
    const width = Math.max(1, Math.round(picture.width * scale));
    const height = Math.max(1, Math.round(picture.height * scale));
    const image = (
        <img
            alt=""
            className="kissopen-agent-activity__picture"
            data-kissopen-desktop-ui="agent-activity-picture"
            data-path={picture.path}
            height={height}
            src={picture.preview}
            width={width}
        />
    );
    if (!props.onOpen) return image;
    return (
        <button
            aria-label={t("Enlarge picture")}
            className="kissopen-agent-activity__picture-button"
            data-kissopen-desktop-ui="agent-activity-picture-button"
            onClick={() => props.onOpen?.(picture)}
            type="button"
        >
            {image}
        </button>
    );
}
