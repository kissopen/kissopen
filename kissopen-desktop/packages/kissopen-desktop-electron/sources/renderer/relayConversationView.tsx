/*
A conversation on another machine, drawn by the window's own conversation view.

Nothing here draws a transcript or a composer. Both are the components the
local workspace already uses, so a conversation on a Mac reads on a Windows
desktop exactly as one on this machine does — same bubbles, same composer, same
keyboard. A second, plainer chat surface beside the real one would have been a
worse answer to "let me carry on over here" than no answer at all.

What this file does own is the join: relay messages in, a send out.
*/
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
    ComposerFooterBar,
    ContextMeter,
    ConversationView,
    type ComposerDictation,
} from "kissopen-desktop-ui";
import type {
    ComposerAttachment,
    DictationSnapshot,
    ConversationStartStore,
    ConversationEntry,
} from "kissopen-desktop-state";
import { t, CONVERSATION_START_IDLE } from "kissopen-desktop-state";
import { plainComposer } from "./relayComposer";
import { scheduleDraftRequest, scheduleFocusRequest } from "./relayScheduleDraft";
import { dictationCurrent } from "./relayDictation";
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import type { RelayTurn, RelayConversation, RelayUsage } from "../shared/relayContract";
import type { AgentState } from "@kissopen/kissopen-sync/storageTypes";
import type { Message } from "@kissopen/kissopen-sync/typesMessage";
import { relayAgentAuthor, relayEntries, RELAY_VIEWER_ID, READER_AUTHOR } from "./relayEntries";
import { relayChoices, relayMessageMode } from "./relayChoices";
import type { Metadata } from "@kissopen/kissopen-sync/storageTypes";

type State =
    | { readonly phase: "loading" }
    | {
          readonly phase: "ready";
          readonly messages: readonly Message[];
          /** How each turn ended, as the agent reported it, when it did. */
          readonly turns?: readonly RelayTurn[];
          /*
           * What the agent is doing right now, carried beside the messages
           * because the rows a person has to answer are in here and nowhere
           * else: a tool call in the transcript looks identical whether its
           * permission was granted a second ago or is still being waited on.
           */
          readonly agentState: AgentState;
          readonly usage: RelayUsage | undefined;
          /** Read from this computer's copy, because the relay did not answer. */
          readonly kept?: boolean;
      }
    | { readonly phase: "failed"; readonly error: string };

export function RelayConversationView(props: {
    readonly bridge: KissopenDesktopBridge;
    readonly sessionId?: string;
    /** The same surface before a remote conversation exists; no alternate starter page. */
    readonly start?: ConversationStartStore;
    /** Where this conversation runs, so the reader knows whose work this is. */
    readonly machineName: string;
    /** It runs in the cloud: the product's own assistant is the one answering. */
    readonly cloud: boolean;
    /** What the conversation is called, for the view's own heading. */
    readonly title: string;
    /** True while the relay says this conversation is working. */
    readonly running: boolean;
    /** The socket to the relay is down, so nothing new can arrive yet. */
    readonly offline?: boolean;
    /** An archived conversation: read, never written to. */
    readonly archived?: boolean;
    /** The session's own metadata, which publishes what it can be asked for. */
    readonly metadata: Metadata | null;
    /** Every conversation host must open linked files in its own preview column. */
    readonly onFileOpen: (path: string) => void;
}) {
    const startSnapshot = useSyncExternalStore(
        props.start?.subscribe ?? noSubscription,
        props.start?.get ?? startIdle,
        props.start?.get ?? startIdle,
    );
    const starting = props.start !== undefined && startSnapshot.phase !== "sent";
    const startBusy =
        starting && ["preparing", "connecting", "sending"].includes(startSnapshot.phase);
    const scopeId = props.start
        ? `relay:new:${startSnapshot.revision}`
        : `relay:${props.sessionId}`;
    const [state, setState] = useState<State>({ phase: "loading" });
    const [notice, setNotice] = useState("");
    const sending = useRef(false);

    /*
     * The clock the transcript reads for anything it times, such as how far a
     * picture being generated has come. It only ticks while the conversation
     * is working: an idle transcript has nothing to count.
     */
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!props.running) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(timer);
    }, [props.running]);

    // One in-flight read and one coalesced follow-up per view lifetime. Discarding
    // a read whenever a newer hint arrives starves the screen during streaming.
    // Publish every completed read in order, then catch up to the newest hint.
    const load = useCallback(
        (signal: { cancelled: boolean; loading?: Promise<void>; again?: boolean }) => {
            const sessionId = props.sessionId;
            if (!sessionId || signal.cancelled) return Promise.resolve();
            signal.again = true;
            if (signal.loading) return signal.loading;
            signal.loading = (async () => {
                while (signal.again && !signal.cancelled) {
                    signal.again = false;
                    try {
                        const answer: RelayConversation =
                            await props.bridge.relayConversation(sessionId);
                        if (signal.cancelled) return;
                        setState(
                            answer.ok
                                ? {
                                      phase: "ready",
                                      messages: answer.messages,
                                      agentState: answer.agentState,
                                      usage: answer.usage,
                                      turns: answer.turns,
                                      kept: answer.offline === true,
                                  }
                                : { phase: "failed", error: answer.error },
                        );
                    } catch (error: unknown) {
                        if (!signal.cancelled)
                            setState({ phase: "failed", error: (error as Error).message });
                    }
                }
            })().finally(() => {
                signal.loading = undefined;
            });
            return signal.loading;
        },
        [props.bridge, props.sessionId],
    );

    /*
     * The draft lives here, because the conversation view keeps none: every
     * keystroke goes out through onComposerValueChange and comes back as a
     * snapshot. Keying it by the session is what stops a half-written
     * sentence following the reader into somebody else's conversation.
     */
    const [heldDraft, heldDraftSet] = useState("");
    const draft = starting ? startSnapshot.draft : heldDraft;
    const setDraft = (value: string | ((held: string) => string)): void => {
        if (starting)
            props.start!.textUpdate(
                typeof value === "function" ? value(props.start!.get().draft) : value,
            );
        else heldDraftSet(value);
    };
    useEffect(() => heldDraftSet(""), [props.sessionId]);
    // The mic: the window's one dictation store, its words appended to the draft.
    const dictation = dictationCurrent();
    const dictationSnapshot = useSyncExternalStore(
        dictation?.subscribe ?? (() => () => {}),
        dictation?.get ?? (() => DICTATION_IDLE),
        dictation?.get ?? (() => DICTATION_IDLE),
    );
    const composerDictation: ComposerDictation | undefined = dictation
        ? {
              status: dictationSnapshot.status,
              elapsedMs: dictationSnapshot.elapsedMs,
              levels: dictationSnapshot.levels,
              ...(dictationSnapshot.error ? { error: dictationSnapshot.error } : {}),
              onToggle: () =>
                  dictation.recordingToggle((text) =>
                      setDraft((held) =>
                          held && !/\s$/u.test(held) ? `${held} ${text}` : held + text,
                      ),
                  ),
          }
        : undefined;

    /*
     * Files waiting with the draft.
     *
     * Held here rather than in the composer, which owns no state: the picker
     * hands over what was chosen and this decides what becomes of it. They go
     * up with the next send, and a send that fails keeps them — the file is
     * the other thing besides the words that a person cannot get back.
     */
    const [heldFiles, heldFilesSet] = useState<readonly ComposerAttachment[]>([]);
    const files = starting ? startSnapshot.attachments : heldFiles;
    useEffect(() => heldFilesSet([]), [props.sessionId]);

    /*
     * The model and effort a message goes out with: the conversation's own.
     *
     * A conversation on another machine or in the cloud offers no model
     * choice here. Its models are that machine's — the cloud's are one
     * service whose routing picks them — so a message carries on with what
     * the conversation is already using.
     */
    const choices = useMemo(() => relayChoices(props.metadata), [props.metadata]);
    const model = choices.model;
    const effort = choices.effort;

    const send = useCallback(async () => {
        if (starting) {
            props.start!.textSubmit();
            return;
        }
        if (!props.sessionId) return;
        const text = draft.trim();
        // A message can be only files: a picture handed over without a word
        // about it is an ordinary thing to do.
        if ((!text && files.length === 0) || sending.current) return;
        sending.current = true;
        setNotice("");
        let answer: Awaited<ReturnType<typeof props.bridge.relaySay>>;
        try {
            /*
             * The bytes are read here, in the window, because that is where the
             * File is. What crosses to the main process is what was read: a File
             * does not survive the boundary, and the key that encrypts it lives
             * on the other side of it.
             */
            const carried = await Promise.all(
                files.map(async (attachment) => ({
                    name: attachment.name,
                    mediaType: attachment.mediaType,
                    bytes: new Uint8Array(await attachment.file.arrayBuffer()),
                })),
            );
            answer = await props.bridge.relaySay(
                props.sessionId,
                text,
                relayMessageMode(choices, model, effort),
                carried,
            );
        } catch (error) {
            // A file that could not be read, or a bridge that threw, must not
            // leave the flag up: every later Send would be ignored in silence.
            answer = { ok: false, error: (error as Error).message };
        } finally {
            sending.current = false;
        }
        // Cleared only on success: a draft that failed to send — and the file
        // that went with it — is the one thing the person cannot get back by
        // themselves.
        if (answer.ok) {
            setDraft("");
            heldFilesSet([]);
        } else setNotice(answer.error);
    }, [
        choices,
        draft,
        effort,
        files,
        model,
        props.bridge,
        props.sessionId,
        props.start,
        starting,
    ]);

    useEffect(() => {
        const signal = { cancelled: false };
        setState({ phase: "loading" });
        setNotice("");
        void load(signal);
        /*
         * The relay says a conversation gained a message; the transcript is
         * read again rather than spliced. Reducing the same stream in two
         * places is how two clients come to disagree about one conversation.
         */
        const stop = props.bridge.relayArrivalSubscribe((sessionId) => {
            if (sessionId === props.sessionId && !signal.cancelled) void load(signal);
        });
        return () => {
            signal.cancelled = true;
            stop();
        };
    }, [load, props.bridge, props.sessionId]);

    const assistant = props.metadata?.bot;
    const agentAuthor = useMemo(
        () =>
            relayAgentAuthor({
                cloud: props.cloud,
                ...(assistant === undefined || assistant === null
                    ? {}
                    : { assistant: { name: assistant.name, username: assistant.username } }),
            }),
        [props.cloud, assistant?.name, assistant?.username],
    );
    const remoteEntries = useMemo(
        () =>
            state.phase === "ready" && props.sessionId
                ? relayEntries(
                      state.messages,
                      props.sessionId,
                      state.agentState,
                      state.turns,
                      props.running,
                      agentAuthor,
                  )
                : [],
        [state, props.sessionId, props.running, agentAuthor],
    );
    // A new conversation has no earlier user message. Keep its pending first message
    // visible until that new transcript confirms a user message, never compare text.
    const firstConfirmed =
        state.phase === "ready" && state.messages.some((message) => message.kind === "user-text");
    const submitted = props.start && !firstConfirmed ? startSnapshot.submitted : undefined;
    const entries: readonly ConversationEntry[] = submitted
        ? [
              {
                  kind: "message",
                  source: "local",
                  delivery: startSnapshot.phase === "sent" ? "sent" : "sending",
                  message: {
                      id: `${scopeId}:first`,
                      chatId: scopeId,
                      sessionId: scopeId,
                      sequence: "0",
                      changePts: "0",
                      sender: READER_AUTHOR,
                      text:
                          submitted.text ||
                          submitted.attachments.map((file) => file.name).join("\n"),
                      reactions: [],
                      attachments: [],
                      createdAt: new Date(submitted.at).toISOString(),
                  },
              },
              ...remoteEntries,
          ]
        : remoteEntries;

    const gauge = useMemo(
        () => (state.phase === "ready" ? contextGauge(state.usage) : undefined),
        [state],
    );

    /*
     * A decision, and stopping a run.
     *
     * Both are asks of the machine the conversation runs on, and both can be
     * refused by it — a computer that is asleep answers nothing. The reader
     * is told when that happens, in the same place a failed send is told,
     * rather than left looking at a control that appeared to do nothing.
     */
    const answerQuestion = useCallback(
        async (requestId: string, answers: Readonly<Record<string, readonly string[]>>) => {
            if (!props.sessionId) return;
            setNotice("");
            const answer = await props.bridge.relayAnswerQuestion(
                props.sessionId,
                requestId,
                answers,
            );
            if (!answer.ok) setNotice(answer.error);
        },
        [props.bridge, props.sessionId],
    );
    const decide = useCallback(
        async (requestId: string, decision: "approve" | "deny") => {
            if (!props.sessionId) return;
            setNotice("");
            const answer = await props.bridge.relayDecide(
                props.sessionId,
                requestId,
                decision === "approve",
            );
            if (!answer.ok) setNotice(answer.error);
        },
        [props.bridge, props.sessionId],
    );

    const abort = useCallback(async () => {
        if (!props.sessionId) return;
        setNotice("");
        const answer = await props.bridge.relayAbort(props.sessionId);
        if (!answer.ok) setNotice(answer.error);
    }, [props.bridge, props.sessionId]);

    /*
     * A file the conversation named, opened.
     *
     * The path is passed on as written: it belongs to the folder that
     * conversation works in, on a machine that is not this one, and that
     * machine is the only place it means anything. The conversation's panel
     * reads those bytes and previews them beside the transcript.
     *
     * Without this the link was drawn as plain text — the reader was shown the
     * name of a file they had been given and no way to reach it.
     */
    const fileOpen = useCallback(
        (path: string) => {
            if (!props.sessionId) return;
            setNotice("");
            props.onFileOpen(path);
        },
        [props.onFileOpen, props.sessionId],
    );

    return (
        <ConversationView
            title={props.title}
            subtitle={props.machineName}
            conversationId={scopeId}
            // Who is reading: without it every message is somebody unknown,
            // drawn on the side meant for other people.
            viewerId={RELAY_VIEWER_ID}
            entries={entries}
            now={now}
            loading={!!props.sessionId && state.phase === "loading" && !submitted}
            // Whether the reader is waiting. Without it a remote conversation
            // reads as finished the moment it is opened.
            running={props.running || startBusy}
            composer={plainComposer(scopeId, draft, files)}
            composerFocusOnType
            composerDictation={composerDictation}
            onComposerValueChange={setDraft}
            onComposerSend={() => void send()}
            // A conversation that will not open has nothing to write into, and
            // a composer over an error invites a message into the void.
            composerDisabled={
                startBusy || (state.phase === "failed" && !starting) || props.archived === true
            }
            composerSubmitDisabled={props.offline === true}
            composerPlaceholder={
                !props.sessionId
                    ? t("和云端助手说点什么…")
                    : t("在「{machine}」上继续这段工作…", {
                          machine: props.machineName,
                      })
            }
            // The send control becomes stop while the agent is working, which
            // is the same control the local transcript offers.
            {...(props.running && !startBusy ? { onAbort: () => void abort() } : {})}
            onRequestDecide={(requestId, decision) => void decide(requestId, decision)}
            // A question the agent asked, answered over the relay.
            onRequestAnswer={(requestId, answers) => void answerQuestion(requestId, answers)}
            onFileOpen={(path) => void fileOpen(path)}
            // Where a task the assistant proposed is set up and confirmed.
            onScheduleProposalOpen={scheduleDraftRequest}
            // Where a task the agent created is shown among the rest.
            onScheduledTaskOpen={scheduleFocusRequest}
            // A task the agent created on its own machine runs on this one.
            scheduleMachineName={props.machineName}
            // The full picture, read from the machine that made it.
            onPictureRead={async (picture) => {
                if (!props.sessionId) return undefined;
                const answer = await props.bridge.relayFileRead(props.sessionId, picture.path);
                return answer.ok ? `data:${picture.mediaType};base64,${answer.base64}` : undefined;
            }}
            onComposerAttachmentsSelect={(picked) =>
                starting
                    ? picked.map(attachmentOf).forEach((file) => props.start!.attachmentAdd(file))
                    : heldFilesSet((current) => [...current, ...picked.map(attachmentOf)])
            }
            onComposerAttachmentRemove={(id) =>
                starting
                    ? props.start!.attachmentRemove(id)
                    : heldFilesSet((current) =>
                          current.filter((attachment) => attachment.id !== id),
                      )
            }
            {...(gauge
                ? {
                      composerFooterControl: (
                          <ComposerFooterBar
                              trailing={
                                  <ContextMeter
                                      totalTokens={gauge.totalTokens}
                                      usedTokens={gauge.usedTokens}
                                      measured={gauge.measured}
                                  />
                              }
                          />
                      ),
                  }
                : {})}
            {...(startSnapshot.error
                ? { notice: startSnapshot.error }
                : state.phase === "failed"
                  ? { notice: state.error }
                  : props.archived
                    ? { notice: t("这段对话已归档，只能查看。") }
                    : notice
                      ? { notice }
                      : props.offline
                        ? { notice: t("与云端的连接断开了，正在重新连接；恢复后会自动更新。") }
                        : state.phase === "ready" && state.kept
                          ? { notice: t("暂时连不上云端，显示的是这台电脑上保存的记录。") }
                          : {})}
        />
    );
}

/*
How much of its window this conversation has spent.

Absent until a window is known at all: a meter drawn over a made-up total is
worse than no meter, because the reader would pace themselves against it. Once
the window is known the bar appears even before the first measurement, holding
a zero that says "nothing spent yet" rather than hiding until it has news.
*/
function contextGauge(usage: RelayUsage | undefined) {
    const totalTokens = usage?.contextWindow;
    if (!totalTokens) return undefined;
    return { totalTokens, usedTokens: usage?.contextSize ?? 0, measured: usage !== undefined };
}

/*
One picked file, waiting with the draft.

Everything goes as a workspace file rather than an inline image, including
pictures: an inline image is handed to the model as part of the message, and
that is a decision for the agent on the other end to make about its own
provider — not for a window that is only passing the file along.
*/
function attachmentOf(file: File): ComposerAttachment {
    return {
        kind: "workspaceFile",
        id: `relay-file:${String(Date.now())}:${file.name}`,
        name: file.name,
        size: file.size,
        mediaType: file.type || "application/octet-stream",
        file,
    };
}

/*
The composer as the view wants it: a snapshot, not a store.

The view owns no draft — every keystroke leaves through onComposerValueChange
and returns here — so this is the whole of what it needs to draw one.
*/

const DICTATION_IDLE: DictationSnapshot = { status: "idle", elapsedMs: 0, error: "", levels: [] };
const noSubscription = (): (() => void) => () => {};
const startIdle = () => CONVERSATION_START_IDLE;
