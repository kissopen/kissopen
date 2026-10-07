import { t } from "kissopen-desktop-state";
import {
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    type ChangeEvent,
    type ClipboardEvent as ReactClipboardEvent,
    type CSSProperties,
    type DragEvent as ReactDragEvent,
    type FormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from "react";
import { AudienceToggle, type AudienceValue } from "./AudienceToggle";
import { CommandPicker, type CommandPickerItem } from "./CommandPicker";
import { Avatar, type ToneName } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import {
    ComposerAttachmentPreviews,
    type ComposerAttachmentPreview,
} from "./ComposerAttachmentPreviews";
import { EmojiPicker, type EmojiItem } from "./EmojiPicker";
import { Icon, type IconName } from "./Icon";
import { ScrollbarTracks, useScrollbarController } from "./Scrollbar";
/* ---- ContextChips ----------------------------------------------------- */
export type ContextKind = "file" | "image" | "run";
export type ContextItem = {
    detail?: string;
    id: string;
    kind: ContextKind;
    label: string;
};
export type ContextChipsProps = {
    className?: string;
    "data-testid"?: string;
    items: ContextItem[];
    label?: string;
    onRemove?: (id: string) => void;
    readOnly?: boolean;
    style?: CSSProperties;
};
const kindIcons: Record<ContextKind, IconName> = {
    file: "doc",
    image: "image",
    run: "play",
};
/** Attached-context row for the composer: 24px chips with kind icons. */
export function ContextChips(props: ContextChipsProps) {
    return (
        <div
            className={["kissopen-context-chips", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="context-chips"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {props.label ? (
                <span
                    className="kissopen-context-chips__label"
                    data-kissopen-desktop-ui="context-chips-label"
                >
                    {props.label}
                </span>
            ) : null}
            {props.items.map((item) => (
                <span
                    className="kissopen-context-chips__chip"
                    key={item.id}
                    data-kind={item.kind}
                    data-kissopen-desktop-ui="context-chips-chip"
                >
                    <span
                        className="kissopen-context-chips__icon"
                        data-kissopen-desktop-ui="context-chips-icon"
                    >
                        <Icon name={kindIcons[item.kind]} size={12} />
                    </span>
                    <span
                        className="kissopen-context-chips__text"
                        data-kissopen-desktop-ui="context-chips-text"
                    >
                        {item.label}
                    </span>
                    {item.detail ? (
                        <span
                            className="kissopen-context-chips__detail"
                            data-kissopen-desktop-ui="context-chips-detail"
                        >
                            {item.detail}
                        </span>
                    ) : null}
                    {!props.readOnly && props.onRemove ? (
                        <button
                            aria-label={t("Remove {name}", { name: item.label })}
                            className="kissopen-context-chips__remove"
                            data-kissopen-desktop-ui="context-chips-remove"
                            onClick={() => props.onRemove?.(item.id)}
                            type="button"
                        >
                            <Icon name="close" size={12} />
                        </button>
                    ) : null}
                </span>
            ))}
        </div>
    );
}
/* ---- MentionPicker ----------------------------------------------------- */
export type Mentionable = {
    description?: string;
    id: string;
    initials: string;
    name: string;
    status?: "ready" | "working";
    tone?: ToneName;
};
export type MentionPickerProps = {
    /** Optional controlled highlight; defaults to the first filtered mention. */
    activeId?: string;
    className?: string;
    "data-testid"?: string;
    /** Visible heading for the picker (default "Mentions"). */
    label?: string;
    /** Exactly the candidates to show; whoever owns the query decides them. */
    mentions?: Mentionable[];
    onSelect: (mention: Mentionable) => void;
    /** The token these candidates answer, named in the empty state. */
    query: string;
    style?: CSSProperties;
};
function filterMentions(mentions: Mentionable[], query: string) {
    const needle = query.trim().toLowerCase();
    return needle
        ? mentions.filter((mention) => mention.name.toLowerCase().includes(needle))
        : mentions;
}
/**
 * Raised popover listing the mention candidates it is given. It spans the
 * composer it belongs to and wears the command picker's geometry — quiet
 * section headings over one-line 32px rows — so `@` and `/` are one surface.
 */
export function MentionPicker(props: MentionPickerProps) {
    const candidates = () => props.mentions ?? [];
    const activeId = () => props.activeId ?? candidates()[0]?.id;
    const row = (mention: Mentionable) => (
        <button
            aria-selected={mention.id === activeId() ? "true" : "false"}
            key={mention.id}
            className="kissopen-mention-picker__row"
            data-active={mention.id === activeId() ? "" : undefined}
            data-kissopen-desktop-ui="mention-picker-row"
            data-mention-id={mention.id}
            onClick={() => props.onSelect(mention)}
            role="option"
            type="button"
        >
            <Avatar initials={mention.initials} size="xs" tone={mention.tone} type="agent" />
            <span
                className="kissopen-mention-picker__meta"
                data-kissopen-desktop-ui="mention-picker-meta"
            >
                <span
                    className="kissopen-mention-picker__name"
                    data-kissopen-desktop-ui="mention-picker-name"
                >
                    {mention.name}
                </span>
                {mention.description ? (
                    <span
                        className="kissopen-mention-picker__description"
                        data-kissopen-desktop-ui="mention-picker-description"
                    >
                        {mention.description}
                    </span>
                ) : null}
            </span>
            {mention.status
                ? ((status) => (
                      <Badge
                          className="kissopen-mention-picker__status"
                          label={status}
                          variant={status === "ready" ? "success" : "warning"}
                      />
                  ))(mention.status)
                : null}
        </button>
    );
    return (
        <div
            aria-label={props.label ?? "Mentions"}
            className={["kissopen-mention-picker", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="mention-picker"
            data-testid={props["data-testid"]}
            role="listbox"
            style={props.style}
        >
            <div
                className="kissopen-mention-picker__header"
                data-kissopen-desktop-ui="mention-picker-header"
            >
                {props.label ?? "Mentions"}
            </div>
            {candidates().length > 0 ? (
                candidates().map(row)
            ) : (
                <div
                    className="kissopen-mention-picker__empty"
                    data-kissopen-desktop-ui="mention-picker-empty"
                >
                    {t("No mentions match “{query}”", { query: props.query })}
                </div>
            )}
        </div>
    );
}
/* ---- Composer ----------------------------------------------------------- */
export type ComposerDictation = {
    readonly status: "idle" | "recording" | "transcribing";
    readonly elapsedMs: number;
    /** Why the last recording gave no words; drawn under the mic until the next one. */
    readonly error?: string;
    /** How loud the room has been, 0–1, newest last; drawn as a wave where the draft was. */
    readonly levels?: readonly number[];
    readonly onToggle: () => void;
};

export type ComposerProps = {
    /** Native file-picker accept filter, used with `onAttachmentsSelect`. */
    attachmentAccept?: string;
    /** Allows more than one file in the native picker. */
    attachmentMultiple?: boolean;
    /** Draft files rendered as compact square previews above the text. */
    attachmentPreviews?: readonly ComposerAttachmentPreview[];
    /**
     * Current message destination. Supplying it (with `onAudienceChange`)
     * renders the People/Agents toggle and enables Shift+Tab switching.
     */
    audience?: AudienceValue;
    className?: string;
    /** Short companion for `hint`, shown only when the toolbar needs to compact. */
    compactHint?: string;
    /**
     * Native plugin composer contribution triggers. The composer retains this
     * integration point while those controls are temporarily withheld.
     */
    contributions?: ReactNode;
    contextItems?: ContextItem[];
    /**
     * Slash commands offered for the current draft, already filtered by the
     * owner. Supplying them (with `onCommandSelect`) renders the command
     * popover and gives the arrow keys, Enter, and Tab to it.
     */
    commands?: readonly CommandPickerItem[];
    /** Chooses a command from the popover; the owner may invoke it or expand it in the draft. */
    onCommandSelect?: (id: string) => void;
    "data-testid"?: string;
    disabled?: boolean;
    /**
     * Makes this composer the last resort for content the surface has no other
     * home for: a character typed — or a Cmd/Ctrl+V pasted — while no control
     * that wants it has focus moves focus here and lands in the draft, and files
     * dragged anywhere over the window that nothing else answers are attached
     * here rather than opened by the browser. Only the composer the reader is
     * currently writing into may claim any of that, so an owner that mounts more
     * than one composer at a time turns it on for exactly one of them.
     */
    focusOnType?: boolean;
    /**
     * What this composer is currently writing into. Whenever the value changes
     * the caret is put in the draft, so arriving somewhere new — a conversation
     * just opened, a workspace just made — is already somewhere to type.
     *
     * It is the identity of the destination rather than a "focus now" flag,
     * because the same composer stays mounted across the move: what changed is
     * the only thing that can say a move happened at all. An owner that never
     * wants the caret taken leaves it out, and one that mounts two composers
     * gives it to whichever of them is being written into.
     */
    focusKey?: string;
    /** e.g. "Enter to send · @ to hand off to an agent" */
    hint?: string;
    /**
     * Speaking instead of typing. The mic starts a recording, becomes stop
     * while it runs (with how long it has), and waits while the words come
     * back; the host puts them into the draft. Absent draws no mic.
     */
    dictation?: ComposerDictation;
    /** Opens a host-owned attachment browser. Takes precedence over the native picker. */
    onAttachFile?: () => void;
    /** Called for toggle clicks and Shift+Tab with the next audience. */
    onAudienceChange?: (audience: AudienceValue) => void;
    /** Receives files picked, pasted into the draft, or dropped onto the composer. */
    onAttachmentsSelect?: (files: File[]) => void;
    /** Opens one of the draft's media previews in the full-window viewer. */
    onAttachmentPreviewOpen?: (id: string) => void;
    onContextRemove?: (id: string) => void;
    /** Called after an emoji is selected. Unicode emoji are also inserted into the draft. */
    onEmojiSelect?: (emoji: EmojiItem) => void;
    /** Reports browser focus transitions of the editable text control. */
    onFocusChange?: (focused: boolean) => void;
    /** Called when a mention is inserted from the picker. */
    onMentionSelect?: (mention: Mentionable) => void;
    /**
     * Mention candidates. Passing an array — even an empty one — is what makes
     * this composer a mentioning one: the `@` action, the token detection, and
     * the picker all follow the prop being present rather than the list having
     * anything in it, so a list that is still being searched cannot take the
     * affordance away.
     */
    mentions?: Mentionable[];
    /**
     * The active `@` token when the owner detects it and searches for the
     * candidates itself. Supplying it turns off the local name filter: the list
     * already answers this token, and matching it again here would throw away
     * everything the search matched some other way than by substring.
     */
    mentionQuery?: string;
    /** Visible heading above the mention candidates (default "Mentions"). */
    mentionPickerLabel?: string;
    /** Optional controlled model-selection control, rendered in the composer toolbar. */
    modelControl?: ReactNode;
    /** Optional controlled accessory rendered below the composer card. */
    footerControl?: ReactNode;
    onSend: () => unknown;
    /**
     * Ends the agent's current inference. With `running`, it takes over the send
     * control while the draft is empty; typing gives the control back to sending,
     * because a message written during a run steers it rather than stopping it.
     * Escape in the text control calls it too, whatever the draft holds.
     */
    onStop?: () => void;
    onValueChange: (value: string) => void;
    placeholder?: string;
    /** Keeps the composer geometry stable while the current send is being acknowledged. */
    pending?: boolean;
    /** True while the agent is producing a reply, which is what `onStop` ends. */
    running?: boolean;
    /** Emoji available to the composer's searchable picker. */
    emoji?: EmojiItem[];
    /** Emoji ids rendered in the picker's recent section. */
    recentEmoji?: string[];
    /** Overrides the text-only send check when attached context is sendable. */
    sendEnabled?: boolean;
    /**
     * Keeps the local draft editable while withholding the network submission.
     * This is distinct from `disabled`, which closes the whole composer.
     */
    submitDisabled?: boolean;
    style?: CSSProperties;
    value: string;
};
const LINE_HEIGHT = 22;
const MIN_LINES = 1;

/**
 * How far an edge fade may reach into the draft. It is a ceiling, never a fixed
 * band: a fade is only ever as tall as the line fragment the scrollport is
 * already cutting, so a line that is entirely visible — with its selection and
 * its caret — is never painted over.
 */
const MAX_FADE = 10;

/**
 * The half-leading between a line box's edge and its glyphs: (22 - 14) / 2 for
 * the draft's 14px text on 22px lines. A cut no deeper than this takes leading
 * only — no glyph is sliced — so it needs no fade. Browsers park the draft
 * exactly there: scrolling the caret into view reveals the caret's own box, not
 * the leading below it, leaving the line a couple of pixels short of aligned.
 * Without this the caret's own line, fully legible, was fed to the bottom fade.
 */
const LINE_LEADING = 4;

/**
 * The fade for one cut line, from how much of it the scrollport hides. It never
 * exceeds the hidden part — softening a cut is proportional to the cut, so a
 * line missing 2px is not covered by a 10px band — nor the visible fragment, so
 * a whole line, its selection, and its caret are never painted over.
 */
function cutLineFade(hidden: number) {
    if (hidden <= LINE_LEADING) return 0;
    return Math.min(LINE_HEIGHT - hidden, hidden, MAX_FADE);
}

/**
 * Points inside the card that already belong to something: a control, a link,
 * an editable area, an attachment chip whose name stays selectable, or a
 * popover that owns its own pointer and keyboard interaction. Everything else
 * in the card is the draft's own dead space.
 */
const SURFACE_CLAIMED_TARGETS =
    '[data-kissopen-desktop-ui="composer-popover"], [data-kissopen-desktop-ui="composer-emoji-popover"], [data-kissopen-desktop-ui="context-chips-chip"], button, input, textarea, select, a, [contenteditable], [tabindex], [role="button"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"]';

/**
 * Below the card the composer stops being one input surface. The footer row
 * carries the session's own controls and agent-authored status text, which
 * stays selectable and never hands the caret to the draft.
 */
const FOOTER_TARGETS =
    '[data-kissopen-desktop-ui="composer-audience"], [data-kissopen-desktop-ui="composer-footer"]';

/**
 * Controls that make words out of characters: text entry, and the list and menu
 * roles whose typeahead selects by what is typed. Focus here is the reader
 * writing somewhere else, so the composer never takes a character from them.
 */
const TEXT_TARGETS =
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="option"], [role="searchbox"], [role="textbox"]';

/**
 * Controls that are pressed rather than typed into. They keep only the keys they
 * actually answer to — Enter, which is not a character, and Space — because a
 * button holding focus is usually just where the last click landed. Clicking
 * "+" for a new tab must not mean the next word is swallowed by the button.
 */
const ACTIVATION_TARGETS =
    'button, a[href], [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="radio"]';

/**
 * Cmd/Ctrl+V alone. Paste is the one command shortcut the composer claims,
 * because it carries content rather than performing an action: pasting with
 * nothing focused means putting that text or image somewhere, and the draft is
 * the only place on the surface that can hold it.
 */
function isPasteShortcut(event: KeyboardEvent): boolean {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
    return event.key === "v" || event.key === "V";
}

/**
 * Whether a drag in flight is carrying files. `types` is the only thing a drag
 * lets anyone read before it is dropped — the items themselves stay sealed until
 * then — so it is what decides whether the composer offers itself as the
 * destination. Dragging a selection of text, including one inside the draft,
 * carries no files and is left entirely to the browser.
 */
function dragCarriesFiles(transfer: DataTransfer | null): boolean {
    return transfer !== null && Array.from(transfer.types).includes("Files");
}

/**
 * Whether this keystroke is ordinary typing that nothing on screen has claimed,
 * which is what makes redirecting it into `textarea` a last resort rather than a
 * hijack. It is typing when a single character was produced without a command
 * modifier and no composition is in flight; it is unclaimed when nothing has
 * already handled the event, no text control has focus, no focused button is
 * being pressed with Space, and no modal is up — while a dialog owns the screen
 * the composer behind it is not where the reader is writing. A composer that is
 * not rendered cannot be typed into either.
 *
 * The button rule is the point of the split: `:focus-visible` cannot tell a
 * clicked button from a tabbed-to one (Chromium reports it for both once a key
 * arrives, and WebKit does not focus buttons on click at all), so this asks what
 * the control does with the key instead of how it came to be focused.
 */
function typingIsUnclaimed(event: KeyboardEvent, textarea: HTMLTextAreaElement): boolean {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return false;
    const paste = isPasteShortcut(event);
    if (!paste) {
        if (event.metaKey || event.ctrlKey || event.altKey) return false;
        // Length 1 is what separates a produced character from Escape, Enter,
        // Tab, the arrows, and a dead key waiting for the one it will combine
        // with.
        if (event.key.length !== 1) return false;
    }
    const target = event.target;
    if (target instanceof Element) {
        if (target.closest(TEXT_TARGETS)) return false;
        // A button answers to Space, but never to paste.
        if (!paste && event.key === " " && target.closest(ACTIVATION_TARGETS)) return false;
    }
    if (document.querySelector('[data-kissopen-desktop-ui="modal-overlay"], [role="dialog"]'))
        return false;
    return textarea.isConnected && textarea.checkVisibility();
}
/**
 * Message composer: focus-within surface card with a one-line resting textarea
 * that grows through eight lines, context chips, capability-driven file/mention/emoji actions,
 * a primary send control, and keyboard-accessible picker popovers.
 */
export function Composer(props: ComposerProps) {
    const composerEl = useRef<HTMLDivElement>(null);
    const fileInputEl = useRef<HTMLInputElement>(null);
    const inputEl = useRef<HTMLDivElement>(null);
    const textareaEl = useRef<HTMLTextAreaElement>(null);
    const draftScrollbarController = useScrollbarController("vertical");
    const draftScrollbarHost = useCallback(
        (element: HTMLDivElement | null) => draftScrollbarController.hostSet(element),
        [draftScrollbarController],
    );
    const textareaAttach = useCallback(
        (element: HTMLTextAreaElement | null) => {
            textareaEl.current = element;
            draftScrollbarController.viewportSet(element);
        },
        [draftScrollbarController],
    );
    const wasBusy = useRef(Boolean(props.disabled || props.pending));
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [typedMentionQuery, setTypedMentionQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    /*
     * Which command Enter would run. It is an index rather than an id because
     * the offered list narrows as the draft is typed; the index is clamped into
     * the current list on every read, so a shrinking list moves the highlight
     * instead of losing it.
     */
    const [commandIndex, setCommandIndex] = useState(0);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [emojiQuery, setEmojiQuery] = useState("");
    /* Whether a file drag this composer will take is currently in flight. */
    const [dropActive, setDropActive] = useState(false);
    const restoreFocusAfterSend = useRef(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const busy = Boolean(props.disabled || props.pending);
    const mentionsSupported = () => props.mentions !== undefined;
    const mentions = () => props.mentions ?? [];
    const mentionQuery = () => props.mentionQuery ?? typedMentionQuery;
    const filtered = () =>
        props.mentionQuery === undefined
            ? filterMentions(mentions(), typedMentionQuery)
            : mentions();
    const mentionOpen = () => !busy && mentionStart !== null && mentions().length > 0;
    const activeMention = () => {
        const list = filtered();
        if (list.length === 0) return undefined;
        return list[Math.min(activeIndex, list.length - 1)];
    };
    const commands = () => props.commands ?? [];
    const commandOpen = () => !busy && commands().length > 0 && props.onCommandSelect !== undefined;
    const activeCommand = () => {
        const list = commands();
        if (list.length === 0) return undefined;
        return list[Math.min(commandIndex, list.length - 1)];
    };
    const selectCommand = (id: string) => {
        setCommandIndex(0);
        props.onCommandSelect?.(id);
        textareaEl.current?.focus();
    };
    const canSend = () =>
        !busy &&
        !props.submitDisabled &&
        !commandOpen() &&
        (props.sendEnabled ?? props.value.trim().length > 0);
    /*
     * The send circle is the mic while there is nothing to send: the same
     * button the phone has. The moment the draft has words, or something is
     * attached, it is send again, and what was dictated goes with it.
     */
    const dictateShown = () =>
        Boolean(props.dictation) &&
        !busy &&
        !commandOpen() &&
        !(props.sendEnabled ?? props.value.trim().length > 0);
    /*
     * One control, two acts. While the agent is running an empty draft has
     * nothing to send, so that same circle stops the run; the moment there is
     * something to say it returns to sending, and what it sends steers the run
     * already under way.
     *
     * Unless nothing can be sent at all. A draft left in a composer that has
     * since been closed — the checkout went away, or a send is already in
     * flight — cannot steer anything, so keeping the send control there would
     * leave a disabled circle sitting on top of a run the reader still has to
     * be able to end. Whenever sending is impossible, stopping takes the
     * circle back regardless of what is written.
     */
    const stopShown = () =>
        Boolean(props.running && props.onStop) && (busy || props.value.trim().length === 0);
    const emoji = () => props.emoji ?? [];
    const filteredEmoji = () => {
        const needle = emojiQuery.trim().toLowerCase();
        if (!needle) return emoji();
        return emoji().filter(
            (item) =>
                item.id.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle),
        );
    };
    const hasAttachmentAction = () => Boolean(props.onAttachFile || props.onAttachmentsSelect);
    const audienceEnabled = () => Boolean(props.audience && props.onAudienceChange);
    const audienceToggle = () => {
        if (!props.audience) return;
        props.onAudienceChange?.(props.audience === "agents" ? "people" : "agents");
    };
    /*
     * Sizes the two edge fades from the scrolled draft itself. Every line box is
     * exactly LINE_HEIGHT tall, so what the scrollport cuts at each end is the
     * remainder of the offset: none of it at a line-aligned position — which is
     * where the draft rests after typing or an arrow key, and where both fades
     * collapse to nothing — and up to a line elsewhere. cutLineFade turns that
     * cut into a band, so a badly cut line is softened rather than erased and a
     * barely cut one is left alone, which is what keeps whole lines, selections,
     * and the caret out of the fades entirely.
     *
     * The measurement is written straight to the wrapper because only the
     * committed textarea knows where its own viewport sits, and a scroll gesture
     * must not re-render the composer on every frame to say so.
     */
    const draftFadeSync = (el: HTMLTextAreaElement) => {
        const wrapper = inputEl.current;
        if (!wrapper) return;
        // How much of the first visible line the top edge has taken, and how
        // much of the last one the bottom edge is holding back. Either being
        // zero means that end cuts nothing and gets no fade.
        const cutAbove = el.scrollTop % LINE_HEIGHT;
        const cutBelow =
            (LINE_HEIGHT - ((el.scrollTop + el.clientHeight) % LINE_HEIGHT)) % LINE_HEIGHT;
        const hasBelow = el.scrollHeight - el.clientHeight - el.scrollTop > 0.5;
        const top = cutLineFade(cutAbove);
        const bottom = hasBelow ? cutLineFade(cutBelow) : 0;
        wrapper.style.setProperty("--kissopen-composer-fade-top", `${top}px`);
        wrapper.style.setProperty("--kissopen-composer-fade-bottom", `${bottom}px`);
    };
    const closeMention = () => {
        setMentionStart(null);
        setTypedMentionQuery("");
        setActiveIndex(0);
    };
    const closeEmoji = () => {
        setEmojiOpen(false);
        setEmojiQuery("");
    };
    const closePopovers = () => {
        closeMention();
        closeEmoji();
    };
    // eslint-disable-next-line kissopen-react/no-layout-effect -- a completed send returns real keyboard focus to the committed textarea only when this composer initiated the focus handoff
    useLayoutEffect(() => {
        if (wasBusy.current && !busy && restoreFocusAfterSend.current) {
            textareaEl.current?.focus();
            restoreFocusAfterSend.current = false;
        }
        wasBusy.current = busy;
    }, [busy]);
    // eslint-disable-next-line kissopen-react/no-layout-effect -- moving real keyboard focus to a destination the reader has just arrived at is imperative browser work with no declarative or event-driven boundary: the composer stays mounted across the move, so no ref callback or handler observes it
    useLayoutEffect(() => {
        // A composer nobody can type into is not somewhere to put the caret, and
        // taking focus from whatever does have it would be worse than leaving it
        // where it is.
        if (props.focusKey === undefined || busy) return;
        textareaEl.current?.focus();
    }, [busy, props.focusKey]);
    // eslint-disable-next-line kissopen-react/no-layout-effect -- composer popovers require one document-level outside-pointer listener whose lifetime follows the mounted composer and is completely cleaned up
    useLayoutEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (!composerEl.current?.contains(event.target as Node)) closePopovers();
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    });
    // eslint-disable-next-line kissopen-react/no-layout-effect -- claiming typing that no focused control wants requires one window-level keydown listener, which no handler on a rendered element can express
    useLayoutEffect(() => {
        if (!props.focusOnType || busy) return;
        const onKeyDown = (event: KeyboardEvent) => {
            const textarea = textareaEl.current;
            if (!textarea || !typingIsUnclaimed(event, textarea)) return;
            // Deliberately not prevented: focusing the textarea inside keydown
            // makes the browser deliver this very keystroke to it, so the letter
            // that summoned the composer is the first one typed into it, and a
            // redirected Cmd+V pastes into the draft through the composer's own
            // paste handler — images and files included.
            textarea.focus();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [busy, props.focusOnType]);
    const rememberSelection = () => {
        const el = textareaEl.current;
        if (!el) return;
        setSelection({
            start: el.selectionStart ?? props.value.length,
            end: el.selectionEnd ?? props.value.length,
        });
    };
    const focusAt = (position: number) => {
        const el = textareaEl.current;
        if (!el) return;
        queueMicrotask(() => {
            el.focus();
            el.setSelectionRange(position, position);
            setSelection({ start: position, end: position });
        });
    };
    const replaceSelection = (text: string) => {
        const current = selection;
        const next = props.value.slice(0, current.start) + text + props.value.slice(current.end);
        const nextCaret = current.start + text.length;
        props.onValueChange(next);
        focusAt(nextCaret);
    };
    const detectMention = (el: HTMLTextAreaElement) => {
        // Tracked whenever this composer mentions at all, not only while it has
        // candidates in hand: the first `@` of a searched list is typed before
        // any result exists, and the token it opened is what the picker needs
        // once the results arrive.
        if (!mentionsSupported()) return;
        const caret = el.selectionStart ?? el.value.length;
        const before = el.value.slice(0, caret);
        // Everything up to the next space belongs to the token, so a path
        // typed into a file mention keeps it open past its first slash.
        const match = /(^|[\s([{])@(\S*)$/.exec(before);
        if (!match) {
            closeMention();
            return;
        }
        const query = match[2] ?? "";
        const start = caret - query.length - 1;
        if (mentionStart !== start || typedMentionQuery !== query) setActiveIndex(0);
        setMentionStart(start);
        setTypedMentionQuery(query);
    };
    const selectMention = (mention: Mentionable) => {
        const el = textareaEl.current;
        const start = mentionStart;
        if (!el || start === null) return;
        const caret = el.selectionStart ?? el.value.length;
        const insertion = `@${mention.name} `;
        const next = el.value.slice(0, start) + insertion + el.value.slice(caret);
        closeMention();
        props.onValueChange(next);
        props.onMentionSelect?.(mention);
        const nextCaret = start + insertion.length;
        focusAt(nextCaret);
    };
    const triggerMention = () => {
        const el = textareaEl.current;
        if (!el || busy || !mentionsSupported()) return;
        closeEmoji();
        el.focus();
        const caret = el.selectionStart ?? props.value.length;
        const before = props.value.slice(0, caret);
        const needsSpace = before.length > 0 && !/[\s([{]$/.test(before);
        const insertion = `${needsSpace ? " " : ""}@`;
        const next = before + insertion + props.value.slice(el.selectionEnd ?? caret);
        props.onValueChange(next);
        setMentionStart(caret + insertion.length - 1);
        setTypedMentionQuery("");
        setActiveIndex(0);
        const nextCaret = caret + insertion.length;
        focusAt(nextCaret);
    };
    const triggerEmoji = () => {
        if (busy || emoji().length === 0) return;
        closeMention();
        rememberSelection();
        const open = !emojiOpen;
        setEmojiOpen(open);
        setEmojiQuery("");
        queueMicrotask(() => {
            if (!open) return;
            composerEl.current
                ?.querySelector<HTMLInputElement>('[data-kissopen-desktop-ui="emoji-picker"] input')
                ?.focus();
        });
    };
    const selectEmoji = (id: string) => {
        const item = emoji().find((candidate) => candidate.id === id);
        if (!item) return;
        closeEmoji();
        if (item.char) replaceSelection(item.char);
        else textareaEl.current?.focus();
        props.onEmojiSelect?.(item);
    };
    const triggerAttachment = () => {
        if (busy) return;
        closePopovers();
        if (props.onAttachFile) props.onAttachFile();
        else fileInputEl.current?.click();
    };
    const selectAttachments = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.currentTarget.files ?? []);
        if (files.length > 0) props.onAttachmentsSelect?.(files);
        event.currentTarget.value = "";
        textareaEl.current?.focus();
    };
    const send = () => {
        if (!canSend()) return;
        closePopovers();
        restoreFocusAfterSend.current = true;
        void props.onSend();
        queueMicrotask(() => {
            const textarea = textareaEl.current;
            if (!textarea || textarea.disabled || textarea.readOnly) return;
            textarea.focus();
            restoreFocusAfterSend.current = false;
        });
    };
    const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if (
            event.key === "Tab" &&
            event.shiftKey &&
            audienceEnabled() &&
            !busy &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            audienceToggle();
            return;
        }
        if (commandOpen()) {
            const list = commands();
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setCommandIndex((index) => (Math.min(index, list.length - 1) + 1) % list.length);
                return;
            }
            if (event.key === "ArrowUp") {
                event.preventDefault();
                setCommandIndex(
                    (index) => (Math.min(index, list.length - 1) - 1 + list.length) % list.length,
                );
                return;
            }
            if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
                event.preventDefault();
                const command = activeCommand();
                if (command) selectCommand(command.id);
                return;
            }
            if (event.key === "Escape") {
                // The whole draft is the command being typed, so dismissing the
                // popover and clearing what opened it are the same act.
                event.preventDefault();
                setCommandIndex(0);
                props.onValueChange("");
                return;
            }
        }
        if (mentionOpen()) {
            const list = filtered();
            if (event.key === "ArrowDown" && list.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % list.length);
                return;
            }
            if (event.key === "ArrowUp" && list.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + list.length) % list.length);
                return;
            }
            if (
                (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) &&
                list.length > 0
            ) {
                event.preventDefault();
                const mention = activeMention();
                if (mention) selectMention(mention);
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeMention();
                return;
            }
        }
        if (emojiOpen && event.key === "Escape") {
            event.preventDefault();
            closeEmoji();
            textareaEl.current?.focus();
            return;
        }
        /*
         * Escape stops the run, the way it does in the Kissopen Agent TUI, and it is the
         * last thing Escape can mean here: every popover above has already had
         * its turn and returned. What is half-written stays written — the draft
         * was aimed at the run being called off, not at the next one — and a
         * draft with something in it stops the run just the same, even though
         * the send control has taken the circle back from stop.
         */
        if (
            event.key === "Escape" &&
            props.running &&
            props.onStop &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            props.onStop();
            return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
        }
    };
    const onInput = (event: FormEvent<HTMLTextAreaElement>) => {
        // A new query is a new list; start its highlight at the top.
        setCommandIndex(0);
        props.onValueChange(event.currentTarget.value);
        rememberSelection();
        detectMention(event.currentTarget);
    };
    const onPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
        // Anything on the clipboard that arrived as a file is an attachment: a
        // screenshot, a PDF copied in Finder, a log someone dragged in. Text
        // pastes carry no files and fall through to the textarea untouched.
        const files = Array.from(event.clipboardData.files);
        if (files.length === 0 || !props.onAttachmentsSelect) return;
        event.preventDefault();
        props.onAttachmentsSelect(files);
    };
    /*
     * Dropping files is attaching them, exactly as pasting them is: the same
     * screenshot, the same PDF, arriving by the other gesture. A composer that
     * cannot take attachments at all — or one that is switched off — leaves the
     * drag alone rather than accepting it into nothing.
     */
    const dropAccepted = () => Boolean(props.onAttachmentsSelect) && !props.disabled;
    const attachDropped = (transfer: DataTransfer | null) => {
        const files = Array.from(transfer?.files ?? []);
        if (files.length > 0) props.onAttachmentsSelect?.(files);
    };
    /*
     * Answering `dragover` is what makes the drop possible at all: an
     * unprevented one leaves the browser's own default in charge, which opens
     * the dropped file over the page. It repeats for as long as the pointer is
     * over the card, so it is also what raises the card's drop state.
     */
    const dragOverSurface = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dropAccepted() || !dragCarriesFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (!dropActive) setDropActive(true);
    };
    const dragLeaveSurface = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dropActive) return;
        // `dragleave` also fires on every boundary crossed *inside* the card —
        // into the textarea, onto a control — so the pointer's own position is
        // what says whether the drag has really left it. Leaving the window
        // reports a point outside the card too, which is the same answer.
        const bounds = event.currentTarget.getBoundingClientRect();
        const inside =
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            event.clientY >= bounds.top &&
            event.clientY <= bounds.bottom;
        if (!inside) setDropActive(false);
    };
    const dropOnSurface = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dropAccepted() || !dragCarriesFiles(event.dataTransfer)) return;
        event.preventDefault();
        setDropActive(false);
        attachDropped(event.dataTransfer);
    };
    /*
     * The same claim the composer makes over unclaimed typing, made over a file
     * nothing else on the surface wants: a screenshot dragged at the transcript,
     * the sidebar, or the gap beside the card is meant for this conversation,
     * and the draft is the only place on the surface that can hold it. Left
     * alone the browser would navigate the whole window onto that file instead.
     *
     * A surface that answers the drag itself has already prevented the event by
     * the time it reaches the window, and so has the card above, which is what
     * keeps one drop from being attached twice.
     */
    // eslint-disable-next-line kissopen-react/no-layout-effect -- claiming a file drop no surface wants requires window-level drag listeners whose lifetime follows the mounted composer, which no handler on a rendered element can express
    useLayoutEffect(() => {
        if (!props.focusOnType || !dropAccepted()) return;
        const onDragOver = (event: DragEvent) => {
            if (event.defaultPrevented || !dragCarriesFiles(event.dataTransfer)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
            // Whatever the pointer is over, this composer is where the file will
            // land, so the card says so for the whole flight of the drag.
            setDropActive(true);
        };
        const onDragLeave = (event: DragEvent) => {
            // Only a pointer that has left the window has taken the drag away;
            // every boundary inside the page bubbles the same event here.
            if (
                event.clientX > 0 &&
                event.clientY > 0 &&
                event.clientX < window.innerWidth &&
                event.clientY < window.innerHeight
            )
                return;
            setDropActive(false);
        };
        const onDrop = (event: DragEvent) => {
            setDropActive(false);
            if (event.defaultPrevented || !dragCarriesFiles(event.dataTransfer)) return;
            event.preventDefault();
            attachDropped(event.dataTransfer);
        };
        window.addEventListener("dragover", onDragOver);
        window.addEventListener("dragleave", onDragLeave);
        window.addEventListener("drop", onDrop);
        return () => {
            window.removeEventListener("dragover", onDragOver);
            window.removeEventListener("dragleave", onDragLeave);
            window.removeEventListener("drop", onDrop);
        };
    });
    /*
     * The composer is one input surface, not a small textarea surrounded by
     * dead padding. Keep native and semantic controls in charge of their own
     * pointer interactions, but direct every other point in the card to the
     * editable control. Popovers are visually adjacent to the card but own
     * their separate keyboard interactions, and the footer row below the card
     * is not part of the input surface at all.
     *
     * It runs on mousedown and suppresses that event's default, which is the
     * whole point: pressing a plain <div> otherwise hands focus to the nearest
     * focusable ancestor — the document body — right after this handler asked
     * for the textarea, so the card looked inert everywhere but the text itself.
     * Only dead space is defaulted away; claimed targets return first and keep
     * their own press behavior, including the text selection that starts inside
     * the textarea and the footer.
     */
    const focusTextareaFromSurface = (event: ReactMouseEvent<HTMLDivElement>) => {
        // Composing is the primary button's job. A secondary or middle press is
        // the platform's — a context menu, a paste — and taking its default
        // away would answer a question that was not asked here.
        if (event.button !== 0) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const claimed = target.closest(`${SURFACE_CLAIMED_TARGETS}, ${FOOTER_TARGETS}`);
        if (claimed && event.currentTarget.contains(claimed)) return;
        const textarea = textareaEl.current;
        if (!textarea || textarea.disabled) return;
        event.preventDefault();
        textarea.focus();
    };
    return (
        <div
            className={["kissopen-composer", props.className].filter(Boolean).join(" ")}
            aria-busy={props.pending ? "true" : undefined}
            data-audience={audienceEnabled() ? "" : undefined}
            data-agents={audienceEnabled() && props.audience === "agents" ? "" : undefined}
            data-disabled={props.disabled ? "" : undefined}
            data-dropping={dropActive && dropAccepted() ? "" : undefined}
            data-pending={props.pending ? "" : undefined}
            data-submit-disabled={props.submitDisabled ? "" : undefined}
            data-kissopen-desktop-ui="composer"
            data-testid={props["data-testid"]}
            onDragEnter={dragOverSurface}
            onDragLeave={dragLeaveSurface}
            onDragOver={dragOverSurface}
            onDrop={dropOnSurface}
            onMouseDown={focusTextareaFromSurface}
            onBlur={(event) => {
                const next = event.relatedTarget;
                if (next && !event.currentTarget.contains(next as Node)) closePopovers();
            }}
            style={props.style}
            ref={composerEl}
        >
            <div className="kissopen-composer__surface" data-kissopen-desktop-ui="composer-surface">
                {(props.attachmentPreviews?.length ?? 0) > 0 ? (
                    <div
                        className="kissopen-composer__attachments"
                        data-kissopen-desktop-ui="composer-attachment-previews"
                    >
                        <ComposerAttachmentPreviews
                            items={props.attachmentPreviews ?? []}
                            onOpen={props.onAttachmentPreviewOpen}
                            onRemove={props.onContextRemove}
                            readOnly={busy || !props.onContextRemove}
                        />
                    </div>
                ) : null}
                {(props.contextItems?.length ?? 0) > 0 ? (
                    <div
                        className="kissopen-composer__context"
                        data-kissopen-desktop-ui="composer-context"
                    >
                        <ContextChips
                            items={props.contextItems ?? []}
                            onRemove={props.onContextRemove}
                            readOnly={!props.onContextRemove}
                        />
                    </div>
                ) : null}
                <div
                    className="kissopen-composer__input"
                    data-kissopen-desktop-ui="composer-input"
                    ref={inputEl}
                >
                    {props.dictation?.status === "recording" ? (
                        <div
                            aria-label={t("Recording")}
                            className="kissopen-composer__wave"
                            data-kissopen-desktop-ui="composer-wave"
                            role="img"
                        >
                            {waveBars(props.dictation.levels ?? []).map((level, index) => (
                                <span
                                    className="kissopen-composer__wave-bar"
                                    key={index}
                                    style={{ height: `${4 + Math.round(level * 20)}px` }}
                                />
                            ))}
                            <span className="kissopen-composer__wave-time">
                                {elapsedLabel(props.dictation.elapsedMs)}
                            </span>
                        </div>
                    ) : props.dictation?.status === "transcribing" ? (
                        <div
                            className="kissopen-composer__wave kissopen-composer__wave--wait"
                            data-kissopen-desktop-ui="composer-wave"
                            role="status"
                        >
                            <Spinner size={14} />
                            <span>{t("Converting…")}</span>
                        </div>
                    ) : null}
                    <div
                        className="kissopen-composer__textarea-scroll"
                        data-scrollbar-always=""
                        {...(props.dictation && props.dictation.status !== "idle"
                            ? { hidden: true }
                            : {})}
                        data-scrollbar-axes="vertical"
                        data-scrollbar-host=""
                        data-scrollbar-placement="stable-gutter"
                        ref={draftScrollbarHost}
                    >
                        <textarea
                            className="kissopen-composer__textarea"
                            data-kissopen-desktop-ui="composer-textarea"
                            disabled={props.disabled}
                            readOnly={props.pending}
                            onBlur={() => {
                                rememberSelection();
                                props.onFocusChange?.(false);
                            }}
                            onClick={rememberSelection}
                            onFocus={() => props.onFocusChange?.(true)}
                            onInput={onInput}
                            onKeyDown={onKeyDown}
                            onPaste={onPaste}
                            onScroll={(event) => draftFadeSync(event.currentTarget)}
                            onSelect={rememberSelection}
                            placeholder={props.placeholder}
                            ref={textareaAttach}
                            rows={MIN_LINES}
                            value={props.value}
                        />
                        <ScrollbarTracks controller={draftScrollbarController} />
                    </div>
                    {/* Decorative edge fades: the draft dissolves into the card
                        where it runs past the visible lines, so a clipped line
                        is never cut on a hard edge. */}
                    <div
                        aria-hidden="true"
                        className="kissopen-composer__fade kissopen-composer__fade--top"
                        data-kissopen-desktop-ui="composer-fade-top"
                    />
                    <div
                        aria-hidden="true"
                        className="kissopen-composer__fade kissopen-composer__fade--bottom"
                        data-kissopen-desktop-ui="composer-fade-bottom"
                    />
                </div>
                <div
                    className="kissopen-composer__toolbar"
                    data-kissopen-desktop-ui="composer-toolbar"
                >
                    <div
                        className="kissopen-composer__leading"
                        data-kissopen-desktop-ui="composer-leading"
                    >
                        {hasAttachmentAction() ? (
                            <Button
                                aria-label={t("Attach file")}
                                disabled={busy}
                                icon="plus"
                                iconOnly
                                onClick={triggerAttachment}
                                size="small"
                                variant="ghost"
                            />
                        ) : null}
                        {props.dictation?.error ? (
                            <span
                                className="kissopen-composer__dictation-error"
                                data-kissopen-desktop-ui="composer-dictation-error"
                                role="alert"
                            >
                                {props.dictation.error}
                            </span>
                        ) : null}
                        {mentionsSupported() ? (
                            <Button
                                aria-label={t("Mention someone")}
                                disabled={busy}
                                icon="at"
                                iconOnly
                                onClick={triggerMention}
                                size="small"
                                variant="ghost"
                            />
                        ) : null}
                        {emoji().length > 0 ? (
                            <Button
                                aria-expanded={emojiOpen ? "true" : "false"}
                                aria-haspopup="dialog"
                                aria-label={t("Add emoji")}
                                disabled={busy}
                                icon="smile"
                                iconOnly
                                onClick={triggerEmoji}
                                size="small"
                                variant="ghost"
                            />
                        ) : null}
                    </div>
                    <div
                        className="kissopen-composer__trailing"
                        data-kissopen-desktop-ui="composer-trailing"
                    >
                        {props.modelControl ? (
                            <div
                                className="kissopen-composer__model"
                                data-kissopen-desktop-ui="composer-model"
                            >
                                {props.modelControl}
                            </div>
                        ) : null}
                        {stopShown() ? (
                            <Button
                                aria-label={t("Stop the agent")}
                                className="kissopen-composer__send kissopen-composer__stop"
                                data-action="stop"
                                icon="stop"
                                iconOnly
                                onClick={() => props.onStop?.()}
                                size="small"
                                variant="primary"
                            />
                        ) : props.dictation?.status === "recording" ? (
                            <Button
                                aria-label={t("Stop recording")}
                                className="kissopen-composer__send kissopen-composer__stop"
                                data-action="dictation-stop"
                                icon="stop"
                                iconOnly
                                onClick={() => props.dictation?.onToggle()}
                                size="small"
                                variant="danger"
                            />
                        ) : props.dictation?.status === "transcribing" ? (
                            <Button
                                aria-label={t("Converting…")}
                                className="kissopen-composer__send"
                                data-action="transcribing"
                                disabled
                                icon="mic"
                                iconOnly
                                size="small"
                                variant="primary"
                            />
                        ) : dictateShown() ? (
                            <Button
                                aria-label={t("Dictate")}
                                className="kissopen-composer__send"
                                data-action="dictate"
                                icon="mic"
                                iconOnly
                                onClick={() => {
                                    closePopovers();
                                    props.dictation?.onToggle();
                                }}
                                size="small"
                                variant="primary"
                            />
                        ) : (
                            <Button
                                aria-label={t("Send message")}
                                className="kissopen-composer__send"
                                disabled={!canSend()}
                                icon="arrow-up"
                                iconOnly
                                onClick={send}
                                size="small"
                                variant="primary"
                            />
                        )}
                    </div>
                </div>
                {commandOpen() ? (
                    <div
                        className="kissopen-composer__popover"
                        data-kissopen-desktop-ui="composer-popover"
                        onMouseDown={(event) => event.preventDefault()}
                    >
                        <CommandPicker
                            activeId={activeCommand()?.id}
                            items={commands()}
                            onSelect={selectCommand}
                        />
                    </div>
                ) : null}
                {mentionOpen() ? (
                    <div
                        className="kissopen-composer__popover"
                        data-kissopen-desktop-ui="composer-popover"
                        onMouseDown={(event) => event.preventDefault()}
                    >
                        <MentionPicker
                            activeId={activeMention()?.id}
                            label={props.mentionPickerLabel}
                            mentions={filtered()}
                            onSelect={selectMention}
                            query={mentionQuery()}
                        />
                    </div>
                ) : null}
                {emojiOpen && !busy ? (
                    <div
                        aria-label={t("Choose emoji")}
                        className="kissopen-composer__popover kissopen-composer__popover--emoji"
                        data-kissopen-desktop-ui="composer-emoji-popover"
                        onKeyDown={(event) => {
                            if (event.key !== "Escape") return;
                            event.preventDefault();
                            closeEmoji();
                            textareaEl.current?.focus();
                        }}
                        role="dialog"
                    >
                        <EmojiPicker
                            emoji={filteredEmoji()}
                            onQueryChange={setEmojiQuery}
                            onSelect={selectEmoji}
                            query={emojiQuery}
                            recent={props.recentEmoji}
                        />
                    </div>
                ) : null}
                {props.onAttachmentsSelect && !props.onAttachFile ? (
                    <input
                        accept={props.attachmentAccept}
                        aria-hidden="true"
                        className="kissopen-composer__file-input"
                        multiple={props.attachmentMultiple}
                        onChange={selectAttachments}
                        ref={fileInputEl}
                        tabIndex={-1}
                        type="file"
                    />
                ) : null}
            </div>
            {audienceEnabled() || props.footerControl ? (
                <div
                    className="kissopen-composer__footer"
                    data-kissopen-desktop-ui={
                        audienceEnabled() ? "composer-audience" : "composer-footer"
                    }
                >
                    {audienceEnabled() ? (
                        <AudienceToggle
                            disabled={busy}
                            onChange={(value) => props.onAudienceChange?.(value)}
                            value={props.audience!}
                        />
                    ) : null}
                    {props.footerControl}
                </div>
            ) : null}
        </div>
    );
}

/** A recording's length as m:ss, the way a stopwatch shows it. */
function elapsedLabel(elapsedMs: number): string {
    const seconds = Math.floor(elapsedMs / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Bars across the composer's width. */
const WAVE_BARS = 48;

/** The wave's bars: the latest levels at the right, silence padding the left. */
function waveBars(levels: readonly number[]): number[] {
    const shown = levels.slice(-WAVE_BARS);
    return [...Array<number>(Math.max(0, WAVE_BARS - shown.length)).fill(0), ...shown];
}
