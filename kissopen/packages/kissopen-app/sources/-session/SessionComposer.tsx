import * as React from 'react';
import { Platform } from 'react-native';
import { AgentInput } from '@/components/AgentInput';
import type { MultiTextInputHandle } from '@/components/MultiTextInput';
import { getSuggestions } from '@/components/autocomplete/suggestions';
import { useDraft } from '@/hooks/useDraft';
import { useImagePicker } from '@/hooks/useImagePicker';
import { Modal } from '@/modal';
import { sessionAbort, sessionCancelCommunication } from '@/sync/ops';
import { supportsImageAttachmentsForFlavor } from '@/sync/attachmentSupport';
import { isRigMetadata, isRigMetadataV1, rigCanAbort, rigCanUseAttachments } from '@/sync/rig';
import { storage, useLocalSetting, useSession, useSessionPendingCommunications, useSessionUsage, useSetting } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { t } from '@/text';
import { useCloudDictation } from '@/kissopen/useCloudDictation';
import { useSessionStatus } from '@/utils/sessionUtils';
import type { Session } from '@/sync/storageTypes';
import { useSessionComposerControls } from './useSessionComposerControls';

// Hoisted so AgentInput's memo does not see a new array on every keystroke.
const AUTOCOMPLETE_PREFIXES = ['@', '/'];

/**
 * Writing into the composer from outside it.
 *
 * A host that offers a prompt — a suggestion chip, an option in a message —
 * has to put words where the person is typing. The composer owns that text,
 * so it lends the host a handle rather than letting the host hold a second
 * input of its own; that second input is exactly what used to sit on the home
 * page and take suggestions nobody ever saw again.
 */
export interface SessionComposerHandle {
    /** Replaces what is typed, caret at the end, and focuses the field. */
    setMessage(text: string): void;
    /** What is typed right now, for a host that appends rather than replaces. */
    getMessage(): string;
}

export interface SessionComposerProps {
    /**
     * The session this writes into. Everything else is read from it.
     *
     * Absent on the home's welcome page until the account's cloud workspace has
     * started: there is nothing to read models or permissions from yet, so the
     * composer offers none of them. It is still this composer — a second one
     * for the gap is how the two screens drifted apart in the first place.
     */
    readonly sessionId?: string;
    /** Called once a message has been accepted, for a caller that navigates. */
    readonly onSent?: () => void;
    /**
     * Starts the message somewhere other than this session, and says whether it
     * was accepted. The home's welcome page uses it: a conversation there is a
     * new session every time, so the text opens one rather than joining the one
     * this composer read its models and permissions from. The composer still
     * owns the draft, and clears it on the same terms it clears its own.
     */
    readonly onSubmit?: (text: string) => Promise<boolean>;
    /**
     * Hosted inside another surface rather than owning the screen. An embedded
     * composer has no microphone: the voice call belongs to the screen the
     * session is really on, and two ways to start one is one too many.
     */
    readonly embedded?: boolean;
    /** Suppresses the mic, for a host that runs its own voice control. */
    readonly withoutVoice?: boolean;
    /** Opens the host's own file panel. Only a host that has one passes it. */
    readonly onFileViewerPress?: () => void;
    readonly placeholder?: string;
    readonly onActionAreaOffsetChange?: (offset: number) => void;
    readonly showStatusDetails?: boolean;
    /** Lends the host a way to write into this composer. */
    readonly handleRef?: React.Ref<SessionComposerHandle | null>;
}

/**
 * The composer a person writes to an agent with.
 *
 * One component rather than one set of props, because the two screens that
 * carry it were never going to stay in step otherwise. The home's welcome page
 * is a doorway into a bot's session, so its composer has to be that session's
 * composer — the same models, the same permission and reasoning controls, the
 * same microphone, the same completions — and every attempt to reproduce that
 * by handing an `AgentInput` a matching set of props drifted the moment either
 * side changed. Nothing here is configurable that the session can answer for
 * itself.
 *
 * It owns the draft, which is why the textarea stays uncontrolled: keystrokes
 * never round-trip through React state, so a busy transcript above cannot make
 * typing lag. `onSent` exists for a host that is not the transcript — the
 * welcome page hands the message over and then leaves for the session view.
 */
// Imperative handle exposed by ChatComposer so SessionViewLoaded can read /
// clear the message text without subscribing to it (which would re-render
// the whole loaded screen on every keystroke).
type ChatComposerHandle = {
    getMessage: () => string;
    clearMessage: () => void;
    /** Puts words back after a send that never happened. */
    restoreMessage: (text: string) => void;
    focus: () => void;
};

type ChatComposerProps = Omit<
    React.ComponentProps<typeof AgentInput>,
    'initialValue' | 'onChangeText'
> & {
    sessionId?: string;
    composerHandleRef: React.RefObject<ChatComposerHandle | null>;
};

// Owns the chat-message draft autosave. The textarea itself is uncontrolled:
// keystrokes never round-trip through React state, so the parent can stay
// stable on every keystroke and deletion doesn't batch on a busy main thread.
// `message` here is a low-priority mirror updated via startTransition; it's
// only used to feed useDraft's debounced autosave. Reads/clears on send go
// through the MultiTextInput handle imperatively.
const ChatComposer = React.memo(function ChatComposer(props: ChatComposerProps) {
    const { sessionId, composerHandleRef, ...rest } = props;
    // Synchronously hydrate the textarea with any saved draft so the user sees
    // their work-in-progress on session open without an extra round-trip.
    const initialDraft = React.useMemo(() => {
        // No session, no saved draft to hydrate from: the welcome page before
        // the workspace has started has nowhere to have stored one.
        return sessionId === undefined ? '' : storage.getState().sessions[sessionId]?.draft ?? '';
    }, [sessionId]);
    const inputHandleRef = React.useRef<MultiTextInputHandle>(null);
    const [message, setMessage] = React.useState(initialDraft);

    const applyDraft = React.useCallback((text: string) => {
        inputHandleRef.current?.setTextAndSelection(text, { start: text.length, end: text.length });
        setMessage(text);
    }, []);

    const { clearDraft } = useDraft(sessionId, message, applyDraft);

    const handleChangeText = React.useCallback((text: string) => {
        // Transition keeps the textarea responsive even when the draft
        // autosave / re-render takes longer than a frame.
        React.startTransition(() => setMessage(text));
    }, []);

    React.useImperativeHandle(composerHandleRef, () => ({
        getMessage: () => inputHandleRef.current?.getText() ?? '',
        clearMessage: () => {
            inputHandleRef.current?.setTextAndSelection('', { start: 0, end: 0 });
            setMessage('');
            clearDraft();
        },
        restoreMessage: applyDraft,
        focus: () => inputHandleRef.current?.focus(),
    }), [applyDraft, clearDraft]);

    return (
        <AgentInput
            {...rest}
            ref={inputHandleRef}
            sessionId={sessionId}
            initialValue={initialDraft}
            onChangeText={handleChangeText}
        />
    );
});

export function SessionComposer(props: SessionComposerProps) {
    const session = useSession(props.sessionId);
    // A named session the store has not caught up with is a transient, as it
    // always was: the screen is about to have it, and half a composer in the
    // meantime is worse than none. Naming no session at all is a state, not a
    // transient — the welcome page before the workspace has started — and the
    // composer belongs on screen for it.
    if (props.sessionId !== undefined && !session) return null;
    return <SessionComposerLoaded {...props} session={session} />;
}

function SessionComposerLoaded(props: SessionComposerProps & { session: Session | null }) {
    const { sessionId, session, onSent, onSubmit } = props;
    // A composer sends one message at a time, and does so whether or not it
    // has a session yet, so the in-flight guard only needs a stable key.
    const sendKey = sessionId ?? '';
    const controls = useSessionComposerControls(sessionId, session);
    const sessionStatus = useSessionStatus(session);
    const sessionUsage = useSessionUsage(sessionId);
    const pendingCommunications = useSessionPendingCommunications(sessionId);
    const alwaysShowContextSize = useSetting('alwaysShowContextSize');
    const zenMode = useLocalSetting('zenMode');
    const { selectedImages, pickImages, removeImage, clearImages, addImages } = useImagePicker();

    // With no session there is nothing to ask what it accepts, and an
    // attachment picked now would have nowhere to go.
    const canUseAttachments = session !== null && (isRigMetadataV1(session.metadata)
        ? rigCanUseAttachments(session.metadata)
        : supportsImageAttachmentsForFlavor(session.metadata?.flavor));
    React.useEffect(() => {
        if (!canUseAttachments && selectedImages.length > 0) clearImages();
    }, [canUseAttachments, clearImages, selectedImages.length]);

    // ChatComposer owns the message state + useDraft subscription. We only
    // hold an imperative handle so handleSend can read the live text and
    // clear it without subscribing to it (which would re-render this whole
    // tree on every keystroke).
    const composerHandleRef = React.useRef<ChatComposerHandle | null>(null);
    React.useImperativeHandle(props.handleRef, () => ({
        setMessage: (text: string) => {
            composerHandleRef.current?.restoreMessage(text);
            composerHandleRef.current?.focus();
        },
        getMessage: () => composerHandleRef.current?.getMessage() ?? '',
    }), [props.handleRef]);
    const sendingSessionsRef = React.useRef(new Set<string>());
    const currentSessionIdRef = React.useRef<string | null>(sessionId ?? null);
    React.useEffect(() => {
        currentSessionIdRef.current = sessionId ?? null;
        return () => { currentSessionIdRef.current = null; };
    }, [sessionId]);

    // handleSend reads the live message via the composer ref, so it doesn't
    // need to re-create on every keystroke.
    const handleSend = React.useCallback(() => {
        if (sendingSessionsRef.current.has(sendKey)) return;
        const composer = composerHandleRef.current;
        const liveMessage = composer?.getMessage() ?? '';
        // A host that opens its own session takes the text and nothing else:
        // there is no turn to join here, so none of the delivery bookkeeping
        // below applies. The draft is still cleared on the same terms — only
        // once accepted, and only if the reader has not typed past it.
        if (onSubmit) {
            if (!liveMessage.trim()) return;
            sendingSessionsRef.current.add(sendKey);
            // Cleared before handing over, not after. The host opens a session
            // and goes to it, so by the time it answers this composer has been
            // unmounted and its handle detached — a clear that waited for the
            // answer would never run, and the words would still be sitting here
            // on the way back. Putting them back on a refusal is the cheaper
            // half of the trade.
            composer?.clearMessage();
            void (async () => {
                let accepted = false;
                try {
                    accepted = await onSubmit(liveMessage);
                } catch (error) {
                    console.error('Failed to start a session from the composer:', error);
                } finally {
                    sendingSessionsRef.current.delete(sendKey);
                }
                if (accepted) return;
                // Only if this is still the same composer and the reader has not
                // started something else in it.
                if (composerHandleRef.current === composer && !composer?.getMessage().trim()) {
                    composer?.restoreMessage(liveMessage);
                }
            })();
            return;
        }
        // Delivering into a session needs one. The welcome page always passes
        // onSubmit and returned above, so this only guards a host that named no
        // session and expected the composer to find one anyway.
        if (!sessionId) return;
        if (liveMessage.trim() || selectedImages.length > 0) {
            const attachments = selectedImages.length > 0 ? selectedImages : undefined;
            const communicationsToDismiss = [...pendingCommunications];
            sendingSessionsRef.current.add(sendKey);

            void (async () => {
                try {
                    // Deliver the user's message while the question tool is still
                    // blocked, then dismiss the forms. This keeps the regular text
                    // available as the user's custom response before the agent is
                    // allowed to continue its turn.
                    const accepted = await sync.sendMessage(sessionId, liveMessage, {
                        source: 'chat',
                        attachments,
                        awaitDelivery: communicationsToDismiss.length > 0,
                        onAccepted: () => {
                            // Queued and cleared: nothing can be sent twice
                            // now. Waiting for delivery as well kept every
                            // later Send ignored for as long as the server
                            // was out of reach.
                            sendingSessionsRef.current.delete(sendKey);
                            if (currentSessionIdRef.current === sessionId) {
                                if (composerHandleRef.current === composer && composer?.getMessage() === liveMessage) {
                                    composer.clearMessage();
                                }
                                for (const attachment of attachments ?? []) removeImage(attachment.id);
                            }
                        },
                    });
                    if (!accepted) return;
                    // The host that is not the transcript leaves for it now
                    // that the message is on its way.
                    onSent?.();
                    const dismissals = await Promise.allSettled(communicationsToDismiss.map(communication => (
                        sessionCancelCommunication(sessionId, communication.id, communication.kind)
                    )));
                    for (const dismissal of dismissals) {
                        if (dismissal.status === 'rejected') {
                            console.error('Failed to dismiss an agent question:', dismissal.reason);
                        }
                    }
                } catch (error) {
                    console.error('Failed to send message while dismissing agent questions:', error);
                } finally {
                    sendingSessionsRef.current.delete(sendKey);
                }
            })();
        }
    }, [sessionId, sendKey, selectedImages, removeImage, pendingCommunications, onSent, onSubmit]);


    const handleAbort = React.useCallback(() => {
        if (sessionId) void sessionAbort(sessionId);
    }, [sessionId]);

    // The mic dictates: the clip goes to the account's transcription and the
    // words land in the draft, after whatever is there — the reader may have
    // typed on while the recording was out. A tap on the same button stops it.
    const dictation = useCloudDictation(React.useCallback((text: string) => {
        const composer = composerHandleRef.current;
        if (!composer) return;
        const held = composer.getMessage();
        composer.restoreMessage(held && !/\s$/.test(held) ? `${held} ${text}` : held + text);
        composer.focus();
    }, []));

    // Completions are the session's files, commands and agents. With no session
    // there is nothing to complete from, so the list is simply empty.
    const suggestions = React.useCallback(
        (query: string) => (sessionId === undefined ? Promise.resolve([]) : getSuggestions(sessionId, query)),
        [sessionId],
    );
    const connectionStatus = React.useMemo(() => ({
        text: sessionStatus.statusText,
        color: sessionStatus.statusColor,
        dotColor: sessionStatus.statusDotColor,
        isPulsing: sessionStatus.isPulsing,
    }), [sessionStatus.statusText, sessionStatus.statusColor, sessionStatus.statusDotColor, sessionStatus.isPulsing]);
    const usageData = React.useMemo(() => {
        const source = sessionUsage ?? session?.latestUsage;
        if (!source) return undefined;
        return {
            inputTokens: source.inputTokens,
            outputTokens: source.outputTokens,
            cacheCreation: source.cacheCreation,
            cacheRead: source.cacheRead,
            contextSize: source.contextSize,
            contextWindow: source.contextWindow,
        };
    }, [sessionUsage, session?.latestUsage]);

    const isDisconnected = !sessionStatus.isConnected;
    const silent = props.withoutVoice || props.embedded || isDisconnected;
    return (
        <ChatComposer
            {...controls}
            // The phone selects from this connected Agent's advertised catalog,
            // including enabled custom providers. The shared controls still
            // honor model locks and capability restrictions from that Agent.
            showModelSelector={session !== null}
            composerHandleRef={composerHandleRef}
            sessionId={sessionId}
            placeholder={props.placeholder ?? t('session.inputPlaceholder')}
            metadata={session?.metadata}
            connectionStatus={connectionStatus}
            usageData={usageData}
            alwaysShowContextSize={alwaysShowContextSize}
            zenMode={zenMode}
            showStatusDetails={props.showStatusDetails}
            onFileViewerPress={props.onFileViewerPress}
            // Both read from the session rather than from whoever is hosting
            // this: an agent that cannot be steered mid-turn blocks the send
            // wherever its composer is drawn, and its limits are its own.
            blockSend={session !== null && isRigMetadata(session.metadata) && session.thinking && session.metadata?.capabilities?.steering !== true}
            sessionStatusUsageLimits={session?.agentState?.usageLimits ?? null}
            onSend={handleSend}
            onMicPress={silent ? undefined : dictation.toggle}
            isMicActive={dictation.state === 'recording'}
            isMicBusy={dictation.state === 'transcribing'}
            micLevels={dictation.levels}
            onAbort={isDisconnected || !rigCanAbort(session?.metadata) ? undefined : handleAbort}
            showAbortButton={rigCanAbort(session?.metadata) && (
                sessionStatus.state === 'thinking'
                || sessionStatus.state === 'permission_required'
                || sessionStatus.state === 'input_required'
                || (Platform.OS === 'web' && sessionStatus.state === 'waiting')
            )}
            selectedImages={canUseAttachments ? selectedImages : undefined}
            onPickImages={canUseAttachments ? pickImages : undefined}
            onRemoveImage={canUseAttachments ? removeImage : undefined}
            onAddImages={canUseAttachments ? addImages : undefined}
            autocompletePrefixes={AUTOCOMPLETE_PREFIXES}
            autocompleteSuggestions={suggestions}
            onActionAreaOffsetChange={props.onActionAreaOffsetChange}
        />
    );
}
