/*
Arranging something, by saying what you want.

There is no form here on purpose. A person does not think in recurrence rules
and minutes-past-midnight; they think "every weekday at nine, check what came
in overnight". The server reads that, and what comes back is a draft — shown in
full, because the reader is about to commit to it and "daily at 09:00" is not
the same promise as "every weekday at 09:00".

It is a conversation, in the window's own conversation view, because settling
a time takes more than one sentence and the app already knows how two parties
settle something: you say, it asks, you answer where you were already typing.
The first version showed the server's question as a banner with nothing to
answer it with — the reader had to rewrite their whole sentence, and the server
never learnt what it had asked. A second, worse way to have a conversation,
beside the real one.

Nothing is saved until the draft is confirmed. A sentence that was misread
costs another line, not a plan that fires at the wrong hour.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ConversationView, Select } from "kissopen-desktop-ui";
import type { ConversationEntry } from "kissopen-desktop-state";
import { t } from "kissopen-desktop-state";
import type { ScheduleDraft, ScheduleDraftSaid } from "kissopen-desktop-state";
import { scheduleCreate, scheduleDraftRead, type CloudRequest } from "./relayCloudApi";
import { absolute, describeRecurrence } from "./relayScheduleText";
import { plainComposer } from "./relayComposer";
import { AGENT_AUTHOR, READER_AUTHOR, RELAY_VIEWER_ID, sequenceOf } from "./relayEntries";

/** One thing said while settling this task, in the order it was said. */
type Line = {
    readonly id: string;
    readonly who: "person" | "server";
    readonly text: string;
    /**
     * Answers the server offered to this question. Only the newest line can
     * still be answered by picking one, so a choice never reopens something
     * already settled; after that it is an ordinary thing that was said.
     */
    readonly choices?: readonly string[];
};

const SCOPE = "schedule:new";

export function RelayScheduleCreate(props: {
    readonly request: CloudRequest;
    /**
     * Where a task can run: the cloud workspace, and each of the account's
     * computers. The server never picks this from the sentence — a task
     * that quietly landed on somebody's laptop is the failure the design
     * forbids — so the reader picks, and the cloud is the default.
     */
    readonly targets: readonly {
        readonly value: string;
        readonly label: string;
        /** A computer that cannot be given a task yet; the label says why. */
        readonly disabled?: boolean;
    }[];
    /**
     * The folders a task can run in on one machine, by target. A folder is a
     * project the relay knows on that machine and whose path a conversation
     * there has named; without a path there is nothing for the desktop to
     * open. Empty for the cloud, which has one home.
     */
    readonly projects: (
        target: string,
    ) => readonly { readonly path: string; readonly name: string }[];
    /**
     * What an assistant proposed in a conversation. Said as the first line, as
     * if typed here, so the server reads it the same way and asks the same
     * questions; nothing exists until the reader confirms.
     */
    readonly initialRequest?: string;
    /** Called once the plan exists, so the list can show it. */
    readonly onCreated: () => void;
    readonly onCancel: () => void;
}) {
    const [lines, setLines] = useState<readonly Line[]>([]);
    const [text, setText] = useState("");
    const [draft, setDraft] = useState<ScheduleDraft | null>(null);
    const [selectedTarget, setTarget] = useState("");
    // Readiness can arrive after the dialog opens. Never retain the old cloud
    // default when this client only permits tasks on its own computers.
    const target = props.targets.some((item) => item.value === selectedTarget && !item.disabled)
        ? selectedTarget
        : (props.targets.find((item) => !item.disabled)?.value ?? "");
    /** The folder's path, or "" for the machine's own assistant. */
    const [project, setProject] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    /*
     * This computer's own zone, so "tomorrow at nine" means the reader's nine.
     * The server is told rather than left to assume, because it is somewhere
     * else and its nine is not theirs.
     */
    const timezone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
        } catch {
            return "Asia/Shanghai";
        }
    }, []);

    const say = useCallback(
        async (spoken: string) => {
            const said = spoken.trim();
            if (!said || busy) return;
            /*
             * What went before, as the server takes it. The line just said is
             * not in it: it travels as the newest thing said, which is what
             * the server is being asked to read.
             */
            const before: ScheduleDraftSaid[] = lines.map((line) => ({
                who: line.who,
                text: line.text,
            }));
            setLines((current) => [...current, { id: lineId(), who: "person", text: said }]);
            setText("");
            setNotice("");
            setDraft(null);
            setBusy(true);
            try {
                const answer = await scheduleDraftRead(props.request, said, timezone, before);
                const reply = answer.draft
                    ? describeDraft(answer.draft)
                    : answer.needs || t("When should this run?");
                setDraft(answer.draft ?? null);
                setLines((current) => [
                    ...current,
                    {
                        id: lineId(),
                        who: "server",
                        text: reply,
                        ...(answer.choices && answer.choices.length > 0
                            ? { choices: answer.choices }
                            : {}),
                    },
                ]);
            } catch (thrown) {
                setNotice((thrown as Error).message);
            } finally {
                setBusy(false);
            }
        },
        [busy, lines, props.request, timezone],
    );

    // Once, when the view opens on a proposal. The ref keeps a second render
    // from sending it again.
    const proposed = useRef(false);
    useEffect(() => {
        if (!props.initialRequest || proposed.current) return;
        proposed.current = true;
        void say(props.initialRequest);
    }, [props.initialRequest, say]);

    const create = useCallback(async () => {
        if (busy || !draft) return;
        if (!target) {
            setNotice(t("没有可执行任务的设备，请先连接本地 Agent 并启用定时任务执行器。"));
            return;
        }
        setBusy(true);
        setNotice("");
        try {
            const folder = props.projects(target).find((candidate) => candidate.path === project);
            await scheduleCreate(props.request, { ...draft, target }, folder);
            props.onCreated();
        } catch (thrown) {
            setNotice((thrown as Error).message);
        } finally {
            setBusy(false);
        }
    }, [busy, draft, props, target, project]);

    /*
     * The transcript, with the newest question still open.
     *
     * A question the server offered answers to is drawn the way an assistant's
     * question is drawn everywhere else here: as something to pick from, with
     * the composer still there for an answer nobody listed. Only the last line
     * can be open — once something has been said after it, it is history, and
     * history with live buttons in it invites answering a settled question.
     */
    const entries = useMemo(
        () => lines.map((line, index) => entryOf(line, index, index === lines.length - 1 && !busy)),
        [busy, lines],
    );
    const folders = props.projects(target);

    return (
        <ConversationView
            title={t("New scheduled task")}
            subtitle={t("Times are read in {zone}.", { zone: timezone })}
            conversationId={SCOPE}
            viewerId={RELAY_VIEWER_ID}
            entries={entries}
            running={busy}
            headerActions={
                <Button variant="ghost" onClick={props.onCancel}>
                    {t("Cancel")}
                </Button>
            }
            emptyContent={
                <span className="kissopen-relay-detail__meta">
                    {t("Say what should happen and when.")}
                </span>
            }
            composer={plainComposer(SCOPE, text)}
            onComposerValueChange={setText}
            onComposerSend={() => void say(text)}
            onRequestAnswer={(_id, answers) => {
                const picked = Object.values(answers)[0]?.[0];
                if (picked) void say(picked);
            }}
            composerSubmitDisabled={busy}
            composerPlaceholder={t("Every weekday at 09:00, summarise what came in overnight")}
            {...(draft
                ? {
                      /*
                       * Where the reader commits, above the line they are still
                       * free to type on: a draft can be corrected by saying so,
                       * and where it runs was never the model's to choose.
                       */
                      composerAboveControl: (
                          <div className="kissopen-relay-draft">
                              <Select
                                  label={t("Runs on")}
                                  options={props.targets.map((candidate) => ({
                                      value: candidate.value,
                                      label: candidate.label,
                                      ...(candidate.disabled ? { disabled: true } : {}),
                                  }))}
                                  value={target}
                                  onValueChange={(next) => {
                                      setTarget(next);
                                      setProject("");
                                  }}
                                  disabled={busy}
                              />
                              {folders.length > 0 ? (
                                  /* Only on a machine with folders the relay
                                     knows. The assistant is the default: a task
                                     that names no folder is a message to it. */
                                  <Select
                                      label={t("Runs in")}
                                      options={[
                                          { value: "", label: t("The machine's assistant") },
                                          ...folders.map((folder) => ({
                                              value: folder.path,
                                              label: folder.name,
                                          })),
                                      ]}
                                      value={project}
                                      onValueChange={setProject}
                                      disabled={busy}
                                  />
                              ) : null}
                              <Button disabled={busy || !target} onClick={() => void create()}>
                                  {t("Create")}
                              </Button>
                          </div>
                      ),
                  }
                : {})}
            {...(notice ? { notice } : {})}
        />
    );
}

/*
A draft, said back in one line.

The whole promise, not a summary of it: "daily at 09:00" and "every weekday at
09:00" are different arrangements, and this is the sentence the reader agrees
to. It is also what the server is shown next, so "make it Mondays" has
something to change.
*/
function describeDraft(draft: ScheduleDraft): string {
    return t("{name} — {rule}. First run: {time}.", {
        name: draft.name,
        rule: describeRecurrence(draft),
        time: absolute(draft.next_run_at),
    });
}

function entryOf(line: Line, index: number, open: boolean): ConversationEntry {
    if (open && line.who === "server" && line.choices && line.choices.length > 0) {
        return {
            kind: "request",
            id: line.id,
            sequence: sequenceOf(index),
            request: {
                kind: "userInput",
                requestId: line.id,
                status: "pending",
                questions: [
                    {
                        id: line.id,
                        header: t("New scheduled task"),
                        question: line.text,
                        multiSelect: false,
                        // Nothing here is required: an answer nobody listed is
                        // typed instead, and the composer is right there.
                        required: false,
                        options: line.choices.map((label) => ({ label, description: "" })),
                    },
                ],
            },
        };
    }
    return {
        kind: "message",
        source: "server",
        delivery: "sent",
        message: {
            id: line.id,
            chatId: SCOPE,
            sessionId: SCOPE,
            sequence: sequenceOf(index),
            changePts: line.id,
            sender: line.who === "person" ? READER_AUTHOR : AGENT_AUTHOR,
            text: line.text,
            reactions: [],
            attachments: [],
            createdAt: new Date().toISOString(),
        },
    };
}

let counter = 0;
function lineId(): string {
    counter += 1;
    return `${SCOPE}:${counter}`;
}
