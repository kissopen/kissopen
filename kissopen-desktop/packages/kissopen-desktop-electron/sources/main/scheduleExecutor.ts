/*
The work machine's executor for scheduled runs.

The business server holds the timer; this holds the evidence for runs that are
to happen on this computer. The server cannot reach a computer, so this comes
to it: every few seconds, while somebody is signed in, it says it is here and
takes the runs addressed to this machine. Each one is written down before
anything starts, so a response lost on the way back is resolved by the next
poll handing over the same run in its accepted state, never by running twice.

It mirrors the cloud workspace's gateway step for step — the deadline checked
again before starting, the message sent under the run's own id, success read
from the transcript rather than from the send having been accepted — because
a task should mean the same thing wherever it runs. What the Agent is asked is
only the ordinary send; nothing here needs a contract of its own.

The task goes to this machine's secretary. Every set-up computer has one,
it is the assistant a person here already talks to, and a scheduled task is
something they would otherwise have asked it to do themselves.
*/
import { messageDisplayMetadata } from "@kissopen/kissopen-agent-client";
import { t } from "kissopen-desktop-state/i18n";
import type { ScheduleDeviceOffer, ScheduleDevicePoll } from "kissopen-desktop-state";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { hostname } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { app } from "electron";
import {
    KissopenAgentDaemonClient,
    kissopenAgentDaemonPathsResolve,
    kissopenAgentDaemonTokenRead,
} from "./kissopenAgentDaemonClient";

export interface ScheduleExecutorDeps {
    readonly accountId: string;
    readonly userId: () => string;
    /** An authenticated POST to the business API, under `/api`. */
    readonly post: (
        path: string,
        body: Readonly<Record<string, unknown>>,
    ) => Promise<{ status: number; text: string }>;
    /** This computer, by the id the relay knows it under. Undefined until known. */
    readonly machineId: () => string | undefined;
}

/** One run as this machine knows it, on disk. */
interface Receipt extends Omit<ScheduleDeviceOffer, "status" | "cancel_requested"> {
    /**
     * needs_user is running with a question waiting for the person: the run
     * goes on once it is answered, and until then its time does not count.
     */
    status: "accepted" | "running" | "needs_user" | "succeeded" | "failed" | "cancelled" | "missed";
    cancel_requested: boolean;
    session_id: string;
    summary: string;
    error: string;
    started_at: number;
    ended_at: number;
    /** The Agent run the message was taken into, once known. */
    agent_run_id: string;
    /** The agent the message went to; the secretary's, read at start. */
    agent_id: string;
    /** Whether the server has acknowledged the state this receipt is in. */
    reported: boolean;
    /** Time spent waiting on the person, before the current wait; absent on older receipts. */
    waited_ms?: number;
    /** When the current wait on the person began, while in needs_user. */
    needs_user_since?: number;
}

const POLL_MS = 15_000;
const WATCH_MS = 5_000;
/** How long a run may work, not counting time spent waiting on the person. */
const RUN_LIMIT_MS = 6 * 60 * 60 * 1000;
/** How long one question may wait for the person before the run is given up. */
const NEEDS_USER_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const RECEIPT_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const RUN_ID = /^[A-Za-z0-9_-]{8,64}$/u;

let deps: ScheduleExecutorDeps | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let polling = false;
let pollRequested = false;
/** Runs this process is currently starting or watching, so neither happens twice. */
interface ExecutorScope {
    deps: ScheduleExecutorDeps;
    carrying: Set<string>;
    changing: Map<string, Promise<unknown>>;
    reporting: Map<string, Promise<unknown>>;
}
const lifetime = new AsyncLocalStorage<ExecutorScope>();
let executorScope: ExecutorScope | undefined;
function active(): boolean {
    return lifetime.getStore()?.deps === deps && deps !== undefined;
}
function carrying(): Set<string> {
    return lifetime.getStore()!.carrying;
}

/** Begins polling for this account. Repeats are ignored; sign-out stops it. */
export function scheduleExecutorStart(next: ScheduleExecutorDeps): void {
    if (deps) return;
    deps = next;
    const scope: ExecutorScope = {
        deps: next,
        carrying: new Set<string>(),
        changing: new Map(),
        reporting: new Map(),
    };
    executorScope = scope;
    lifetime.run(scope, () => {
        void receiptsPrune();
    });
    timer = setInterval(
        () =>
            lifetime.run(scope, () => {
                void poll();
            }),
        POLL_MS,
    );
    timer.unref();
    lifetime.run(scope, () => {
        scheduleExecutorWake();
    });
}

/** A newly submitted run need not wait for the periodic poll. */
export function scheduleExecutorWake(): void {
    if (!deps) return;
    if (polling) {
        // Coalesce wakeups, but do not lose a run created after this poll read
        // its offers. The next pass still uses the normal receipt deduplication.
        pollRequested = true;
        return;
    }
    if (active()) void poll();
    else if (executorScope)
        lifetime.run(executorScope, () => {
            void poll();
        });
}

/**
 * Stops asking. Work already started keeps going on the Agent — this cannot
 * and should not reach into it — but nothing more is taken, and what it
 * finishes is reported only if somebody is signed in again by then.
 */
export function scheduleExecutorStop(): void {
    if (timer) clearInterval(timer);
    timer = undefined;
    deps = undefined;
    executorScope = undefined;
    pollRequested = false;
}

function receiptsDir(): string {
    const account = lifetime.getStore()!.deps.accountId;
    return join(
        app.getPath("userData"),
        "schedule-runs",
        createHash("sha256").update(account).digest("hex"),
    );
}

async function receiptRead(runId: string): Promise<Receipt | undefined> {
    if (!RUN_ID.test(runId)) return undefined;
    try {
        return JSON.parse(await readFile(join(receiptsDir(), `${runId}.json`), "utf8")) as Receipt;
    } catch {
        return undefined;
    }
}

/** Written whole and moved into place, so a crash cannot leave half a receipt. */
async function receiptWrite(receipt: Receipt): Promise<void> {
    await mkdir(receiptsDir(), { recursive: true });
    const file = join(receiptsDir(), `${receipt.run_id}.json`);
    await writeFile(`${file}.writing`, JSON.stringify(receipt), { mode: 0o600 });
    await rename(`${file}.writing`, file);
}

async function receiptChange(
    runId: string,
    change: (receipt: Receipt) => void,
): Promise<Receipt | undefined> {
    return serialRun(lifetime.getStore()!.changing, runId, async () => {
        const receipt = await receiptRead(runId);
        if (!receipt) return undefined;
        change(receipt);
        await receiptWrite(receipt);
        return receipt;
    });
}

async function serialRun<T>(
    queue: Map<string, Promise<unknown>>,
    id: string,
    work: () => Promise<T>,
): Promise<T> {
    const next = (queue.get(id) ?? Promise.resolve()).catch(() => undefined).then(work);
    queue.set(id, next);
    try {
        return await next;
    } finally {
        if (queue.get(id) === next) queue.delete(id);
    }
}

const OVER = new Set(["succeeded", "failed", "cancelled", "missed"]);
/** Started and not over: watched until the transcript says it ended. */
const UNDER_WAY = new Set(["running", "needs_user"]);

async function finish(
    runId: string,
    status: Receipt["status"],
    summary: string,
    error: string,
): Promise<void> {
    const receipt = await receiptChange(runId, (receipt) => {
        if (OVER.has(receipt.status)) return;
        receipt.status = status;
        receipt.summary = summary;
        receipt.error = error;
        receipt.ended_at = Date.now();
        receipt.reported = false;
    });
    if (receipt) await report(receipt);
}

/**
 * Tells the server what this run is doing.
 *
 * A report that does not land is tried again on the next poll: the receipt
 * remembers it is unreported, and the poll re-sends every receipt in that
 * state. Only a 200 marks it reported.
 */
async function report(receipt: Receipt): Promise<void> {
    await serialRun(lifetime.getStore()!.reporting, receipt.run_id, async () => {
        const current = active() ? lifetime.getStore()!.deps : undefined;
        const machine = current?.machineId();
        if (!current || !machine) return;
        try {
            // Polling and completion may report together. Read the latest evidence
            // inside this run's queue so a delayed "accepted" cannot overwrite "running".
            receipt = (await receiptRead(receipt.run_id)) ?? receipt;
            if (!active()) return;
            const answer = await current.post(
                `/schedule-devices/${encodeURIComponent(machine)}/runs/${encodeURIComponent(receipt.run_id)}`,
                {
                    status: receipt.status,
                    session_id: receipt.session_id,
                    summary: receipt.summary,
                    error: receipt.error,
                    started_at: receipt.started_at,
                    ended_at: receipt.ended_at,
                },
            );
            if (answer.status === 200 || answer.status === 404)
                await receiptChange(receipt.run_id, (stored) => {
                    if (stored.status === receipt.status) stored.reported = true;
                });
        } catch {
            // Tried again on the next poll.
        }
    });
}

/*
One poll: say this machine is here, take what is addressed to it, and bring
the runs it holds up to date with what the account asked for since.
*/
async function poll(): Promise<void> {
    const current = active() ? lifetime.getStore()!.deps : undefined;
    if (!current || polling) return;
    polling = true;
    try {
        // Keep discovery inside the guard's finally: even an unexpected
        // discovery failure must release polling for a subsequent wakeup.
        if (deps !== current) return;
        const machine = current.machineId();
        if (!machine) return;
        const answer = await current.post(`/schedule-devices/${encodeURIComponent(machine)}/poll`, {
            name: hostname(),
        });
        if (deps !== current || answer.status !== 200) return;
        const { runs } = JSON.parse(answer.text) as ScheduleDevicePoll;
        const listed = new Set<string>();
        for (const offer of runs ?? []) {
            if (deps !== current) return;
            if (
                offer.target !== `machine:${machine}` ||
                offer.user_id !== current.userId() ||
                offer.kind !== "task" ||
                !RUN_ID.test(offer.run_id) ||
                !offer.message_id ||
                !offer.instruction
            )
                continue;
            listed.add(offer.run_id);
            const existing = await receiptRead(offer.run_id);
            if (existing) {
                if (offer.cancel_requested && !existing.cancel_requested)
                    await receiptChange(offer.run_id, (receipt) => {
                        receipt.cancel_requested = true;
                    });
                // Still holding it: said so, so silence is never read as loss.
                if (!OVER.has(existing.status) || !existing.reported) await report(existing);
                if (existing.status === "accepted") void start(offer.run_id);
                else if (UNDER_WAY.has(existing.status)) void watch(offer.run_id);
                continue;
            }
            // Addressed to this machine, this account. The server should never
            // send anything else, and being told to run something is not a
            // reason to run it.
            if (OVER.has(offer.status)) continue;
            await receiptWrite({
                ...offer,
                status: "accepted",
                cancel_requested: offer.cancel_requested,
                session_id: "",
                summary: "",
                error: "",
                started_at: 0,
                ended_at: 0,
                agent_run_id: "",
                agent_id: offer.agent_id ?? "",
                reported: true,
            });
            void start(offer.run_id);
        }
        // Finished runs the server has not acknowledged yet.
        for (const receipt of await receiptsAll()) {
            if (OVER.has(receipt.status) && !receipt.reported && !listed.has(receipt.run_id))
                await report(receipt);
        }
    } catch {
        // Offline, or the server said something else. The next poll asks again.
    } finally {
        polling = false;
        if (pollRequested) {
            pollRequested = false;
            scheduleExecutorWake();
        }
    }
}

async function receiptsAll(): Promise<Receipt[]> {
    let names: string[];
    try {
        names = await readdir(receiptsDir());
    } catch {
        return [];
    }
    const receipts: Receipt[] = [];
    for (const name of names) {
        if (!name.endsWith(".json")) continue;
        const receipt = await receiptRead(name.slice(0, -".json".length));
        if (receipt) receipts.push(receipt);
    }
    return receipts;
}

/**
 * Remove old acknowledged receipts. Resume only from an authenticated poll,
 * so cancellation while this computer was offline is checked before starting.
 */
async function receiptsPrune(): Promise<void> {
    for (const receipt of await receiptsAll()) {
        if (!active()) return;
        if (receipt.kind !== "task" || receipt.target !== `machine:${deps?.machineId()}`) continue;
        if (
            OVER.has(receipt.status) &&
            receipt.reported &&
            receipt.ended_at < Date.now() - RECEIPT_KEEP_MS
        )
            await unlink(join(receiptsDir(), `${receipt.run_id}.json`)).catch(() => undefined);
    }
}

/** The local Agent, when it is up and its credential is readable. */
async function daemon(): Promise<KissopenAgentDaemonClient | undefined> {
    try {
        const paths = kissopenAgentDaemonPathsResolve();
        const token = await kissopenAgentDaemonTokenRead(paths.tokenPath);
        if (!token) return undefined;
        const client = new KissopenAgentDaemonClient({ socketPath: paths.socketPath, token });
        const health = await client.health(AbortSignal.timeout(5000));
        if (!health.healthy || !health.ready || health.draining || health.shuttingDown)
            return undefined;
        return client;
    } catch {
        return undefined;
    }
}

async function daemonJson<T>(
    client: KissopenAgentDaemonClient,
    method: string,
    path: string,
    body?: unknown,
): Promise<{ status: number; body: T | undefined }> {
    if (!active()) throw new Error("The scheduled-task account changed.");
    const response = await client.rawRequest({
        method,
        path,
        ...(body === undefined
            ? {}
            : {
                  body: Buffer.from(JSON.stringify(body)),
                  headers: { "content-type": "application/json" },
              }),
        signal: AbortSignal.timeout(60_000),
    });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += (chunk as Buffer).length;
        if (size > 4 * 1024 * 1024) {
            response.body.destroy();
            break;
        }
        chunks.push(chunk as Buffer);
    }
    let parsed: T | undefined;
    try {
        parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
    } catch {
        parsed = undefined;
    }
    return { status: response.statusCode, body: parsed };
}

/*
Starts one accepted run.

The deadline is checked again here, not only when the run arrived: acceptance
and starting are different moments, and a restart or a sleeping laptop can
separate them by more than the window allows.
*/
async function start(runId: string): Promise<void> {
    if (!active() || carrying().has(runId)) return;
    carrying().add(runId);
    try {
        const receipt = await receiptRead(runId);
        if (!receipt || receipt.status !== "accepted") return;
        if (receipt.cancel_requested) return finish(runId, "cancelled", "", t("用户已取消"));
        if (receipt.start_before > 0 && Date.now() > receipt.start_before)
            return finish(runId, "missed", "", t("已超过补执行时限"));

        // The Agent has to be up before there is anywhere to send this. The
        // wait is bounded by the deadline the run already carries.
        let client = await daemon();
        while (!client) {
            if (!active()) return;
            if (receipt.start_before > 0 && Date.now() > receipt.start_before)
                return finish(runId, "missed", "", t("等待本机助手启动时超过补执行时限"));
            await new Promise((resolve) => setTimeout(resolve, 2000));
            client = await daemon();
        }

        // A run that names a conversation already here goes into it as it is:
        // a task an assistant set up belongs to the conversation it was asked
        // in, bot or project, and looking a folder up for it would register the
        // bot's own folder as a project. A named conversation not here yet (a
        // card's, before its first start) is made the way it always was.
        const named = receipt.agent_id ? await existingAgent(client, receipt.agent_id) : undefined;
        const agentId =
            named ??
            (receipt.project_path ? await projectAgent(client, receipt) : await chiefAgent(client));
        if (typeof agentId !== "string") return finish(runId, "failed", "", agentId.failure);

        // The assistant's own mode, read from it rather than assumed, so a
        // scheduled task runs under the same settings as everything else said
        // to it — and keeps doing so after those settings change. An
        // assistant nobody has spoken to yet has none (the contract says
        // `null` before the first message), and then the daemon's own
        // defaults are the mode, the same ones its composer would offer.
        const bootstrap = await daemonJson<{ mode?: Record<string, unknown> | null }>(
            client,
            "GET",
            `/v0/agents/${encodeURIComponent(agentId)}/bootstrap`,
        );
        if (bootstrap.status !== 200)
            return finish(runId, "failed", "", t("无法读取助手的运行配置"));
        let mode = modeComplete(bootstrap.body?.mode) ? bootstrap.body!.mode! : undefined;
        if (!mode) {
            const config = await daemonJson<{ config?: DaemonConfig }>(client, "GET", "/v0/config");
            if (config.status === 200 && config.body?.config)
                mode = defaultMode(config.body.config);
        }
        if (!mode) return finish(runId, "failed", "", t("这台电脑的助手还没有可用的模型设置"));
        if (!("serviceTier" in mode)) mode.serviceTier = null;

        const text = scheduledTaskText(receipt.name, receipt.instruction);
        await receiptChange(runId, (stored) => {
            stored.agent_id = agentId;
        });
        let sent: { status: number };
        try {
            sent = await daemonJson(
                client,
                "POST",
                `/v0/agents/${encodeURIComponent(agentId)}/send`,
                {
                    id: receipt.message_id,
                    text,
                    // The conversation shows this label, never the prompt above.
                    clientMetadata: messageDisplayMetadata(
                        scheduledRunLabel(receipt.kind, receipt.name),
                    ),
                    mode,
                },
            );
        } catch {
            // Unknown: the message may or may not have been taken. Left for
            // the watcher to establish from the transcript, never re-sent
            // under a different identity.
            const changed = await receiptChange(runId, (stored) => {
                stored.status = "running";
                stored.error = t("投递结果未知，正在确认");
                stored.reported = false;
            });
            if (changed) await report(changed);
            carrying().delete(runId);
            return watch(runId);
        }
        if (sent.status >= 300)
            return finish(
                runId,
                "failed",
                "",
                t("助手拒绝了这条消息（{status}）", { status: sent.status }),
            );
        const running = await receiptChange(runId, (stored) => {
            stored.status = "running";
            stored.started_at = Date.now();
            stored.session_id = agentId;
            stored.error = "";
            stored.reported = false;
        });
        if (running) await report(running);
        carrying().delete(runId);
        return watch(runId);
    } catch (error) {
        await finish(
            runId,
            "failed",
            "",
            t("启动失败：{message}", { message: (error as Error).message }),
        );
    } finally {
        carrying().delete(runId);
    }
}

/*
Watches the assistant until this run's message has been answered.

Success is read from the transcript, not from the send having been accepted.
A run whose message was delivered and then never answered is not a success,
and this leaves it unfinished rather than claim one.
*/
async function watch(runId: string): Promise<void> {
    if (!active() || carrying().has(runId)) return;
    carrying().add(runId);
    try {
        for (;;) {
            if (!active()) return;
            const receipt = await receiptRead(runId);
            if (!receipt || !UNDER_WAY.has(receipt.status)) return;
            const client = await daemon();
            if (client && receipt.cancel_requested && receipt.agent_id) {
                // Asked to stop. The Agent is told; the run stays open until
                // the transcript shows it actually ended.
                await daemonJson(
                    client,
                    "POST",
                    `/v0/agents/${encodeURIComponent(receipt.agent_id)}/abort`,
                    {},
                ).catch(() => undefined);
            }
            const overdue = runOverdue(receipt, Date.now());
            if (overdue) return finish(runId, "failed", "", overdue);
            if (client && receipt.agent_id) {
                // A question waiting for the person pauses the run's clock and
                // is said to the server, so the phone can show it is waiting.
                const pending = await pendingQuestionRead(client, receipt.agent_id).catch(
                    () => undefined,
                );
                if (pending !== undefined) {
                    const changed = await receiptChange(runId, (stored) =>
                        needsUserApply(stored, pending, Date.now()),
                    );
                    if (changed && !changed.reported) await report(changed);
                }
                const outcome = await outcomeRead(client, receipt).catch(() => undefined);
                if (outcome?.done) {
                    const status = receipt.cancel_requested
                        ? "cancelled"
                        : outcome.failure
                          ? "failed"
                          : "succeeded";
                    return finish(runId, status, outcome.summary, outcome.failure);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, WATCH_MS));
        }
    } finally {
        carrying().delete(runId);
    }
}

interface TranscriptMessage {
    id: string;
    role: string;
    content?: { type: string; text?: string }[];
}
interface Transcript {
    runs?: { id: string; status: string; messages?: TranscriptMessage[] }[];
}

/**
 * Whether the assistant has finished answering this run's message.
 *
 * The Agent stamps every message with the run that took it, so our own
 * message id finds the run whether it opened one or was steered into work
 * already under way. Remembered once found, so the run stays recognisable if
 * the message leaves the window this reads.
 */
async function outcomeRead(
    client: KissopenAgentDaemonClient,
    receipt: Receipt,
): Promise<{ done: boolean; summary: string; failure: string }> {
    const page = await daemonJson<Transcript>(
        client,
        "GET",
        `/v0/agents/${encodeURIComponent(receipt.agent_id)}/messages?limit=40`,
    );
    if (page.status !== 200 || !page.body) return { done: false, summary: "", failure: "" };
    for (const candidate of page.body.runs ?? []) {
        const ours =
            (candidate.id !== "" && candidate.id === receipt.agent_run_id) ||
            (candidate.messages ?? []).some((message) => message.id === receipt.message_id);
        if (!ours) continue;
        if (candidate.id && candidate.id !== receipt.agent_run_id)
            await receiptChange(receipt.run_id, (stored) => {
                stored.agent_run_id = candidate.id;
            });
        switch (candidate.status) {
            case "completed":
                return {
                    done: true,
                    summary: lastSaid(candidate.messages ?? [], "agent"),
                    failure: "",
                };
            case "aborted":
                return { done: true, summary: "", failure: t("助手中断了这次运行") };
            case "failed":
                return {
                    done: true,
                    summary: "",
                    failure:
                        lastSaid(candidate.messages ?? [], "error") || t("助手未能完成这次运行"),
                };
            default:
                return { done: false, summary: "", failure: "" };
        }
    }
    return { done: false, summary: "", failure: "" };
}

/**
 * Whether the agent is waiting on the person: its pending question, or null
 * when it has none. Undefined when the agent could not be read.
 */
async function pendingQuestionRead(
    client: KissopenAgentDaemonClient,
    agentId: string,
): Promise<string | null | undefined> {
    const answer = await daemonJson<{
        agent?: { pendingQuestionId?: string | null };
        pendingQuestionId?: string | null;
    }>(client, "GET", `/v0/agents/${encodeURIComponent(agentId)}`);
    if (answer.status !== 200 || !answer.body) return undefined;
    const pending = answer.body.agent?.pendingQuestionId ?? answer.body.pendingQuestionId ?? null;
    return typeof pending === "string" && pending ? pending : null;
}

/**
 * Moves a receipt between running and needs_user as the agent's pending
 * question comes and goes, keeping the time spent waiting apart from the time
 * spent working. Marks it unreported when it changes, so the change is said.
 */
export function needsUserApply(
    receipt: Pick<Receipt, "status" | "reported" | "waited_ms" | "needs_user_since">,
    pending: string | null,
    now: number,
): void {
    if (pending && receipt.status === "running") {
        receipt.status = "needs_user";
        receipt.needs_user_since = now;
        receipt.reported = false;
    } else if (!pending && receipt.status === "needs_user") {
        receipt.status = "running";
        receipt.waited_ms =
            (receipt.waited_ms ?? 0) + Math.max(0, now - (receipt.needs_user_since ?? now));
        delete receipt.needs_user_since;
        receipt.reported = false;
    }
}

/**
 * Why a run under way is given up, when it is: it worked longer than a run
 * may, counting only its running time, or one question waited on the person
 * for longer than a question may.
 */
export function runOverdue(
    receipt: Pick<Receipt, "status" | "started_at" | "waited_ms" | "needs_user_since">,
    now: number,
): string | undefined {
    if (receipt.started_at <= 0) return undefined;
    if (receipt.status === "needs_user") {
        const since = receipt.needs_user_since ?? now;
        if (now - since > NEEDS_USER_LIMIT_MS) return t("等待你的回答超过 7 天，这次运行已结束");
        return undefined;
    }
    if (now - receipt.started_at - (receipt.waited_ms ?? 0) > RUN_LIMIT_MS)
        return t("等待助手完成超时，结果未确认");
    return undefined;
}

/**
 * What a conversation already holds: this run's own message, somebody else's
 * messages, or nothing yet.
 */
async function conversationHistory(
    client: KissopenAgentDaemonClient,
    agentId: string,
    messageId: string,
): Promise<"ours" | "other" | "empty"> {
    const page = await daemonJson<Transcript>(
        client,
        "GET",
        `/v0/agents/${encodeURIComponent(agentId)}/messages?limit=40`,
    );
    if (page.status !== 200 || !page.body) return "empty";
    const messages = (page.body.runs ?? []).flatMap((run) => run.messages ?? []);
    if (messages.some((message) => message.id === messageId)) return "ours";
    return messages.length > 0 ? "other" : "empty";
}

interface DaemonConfig {
    defaults?: Record<string, unknown> | null;
    providers?: Record<
        string,
        { enabled?: boolean; models?: { id: string; enabled?: boolean }[] }
    > | null;
    models?: Record<string, { defaultEffort?: string }> | null;
}

/*
 * The daemon's own defaults, checked against what it actually has enabled.
 *
 * The defaults name a provider and a model; the send API refuses a model its
 * provider does not offer or has switched off. When the defaults point at such
 * a pair the first enabled provider and its first enabled model stand in, with
 * that model's own default effort — the same choice the composer makes for a
 * person opening a fresh conversation.
 */
function defaultMode(config: DaemonConfig): Record<string, unknown> | undefined {
    const providers = config.providers ?? {};
    const enabled = (provider: string, model: string) =>
        providers[provider]?.enabled === true &&
        (providers[provider]?.models ?? []).some((m) => m.id === model && m.enabled === true);
    const mode: Record<string, unknown> = { effort: "medium", permissionMode: "auto" };
    for (const [key, value] of Object.entries(config.defaults ?? {}))
        if (value !== null && value !== undefined) mode[key] = value;
    if (!enabled(String(mode.providerId ?? ""), String(mode.modelId ?? ""))) {
        const pick = Object.keys(providers)
            .sort()
            .flatMap((name) =>
                providers[name]?.enabled
                    ? (providers[name]?.models ?? [])
                          .filter((m) => m.enabled === true)
                          .slice(0, 1)
                          .map((m) => ({ provider: name, model: m.id }))
                    : [],
            )[0];
        if (!pick) return undefined;
        mode.providerId = pick.provider;
        mode.modelId = pick.model;
        const effort = config.models?.[pick.model]?.defaultEffort;
        if (effort) mode.effort = effort;
    }
    return modeComplete(mode) ? mode : undefined;
}

/** This machine's secretary, which is where a task with no folder goes. */
/** The conversation with this id, when this computer's Agent has it. */
async function existingAgent(
    client: KissopenAgentDaemonClient,
    agentId: string,
): Promise<string | undefined> {
    const found = await daemonJson<{ agent?: { id?: string } }>(
        client,
        "GET",
        `/v0/agents/${encodeURIComponent(agentId)}`,
    ).catch(() => undefined);
    return found && found.status < 300 && found.body?.agent?.id === agentId ? agentId : undefined;
}

async function chiefAgent(
    client: KissopenAgentDaemonClient,
): Promise<string | { failure: string }> {
    const bots = await daemonJson<{
        bots?: { systemKey: string | null; archivedAt: number | null; agent?: { id?: string } }[];
    }>(client, "GET", "/v0/bots");
    const chief = bots.body?.bots?.find(
        (bot) => bot.systemKey === "chief_of_staff" && bot.archivedAt === null,
    );
    return chief?.agent?.id ?? { failure: t("这台电脑上没有可用的小秘书") };
}

/*
An agent in the folder the task names.

The folder becomes a project here if it is not one yet — the same registration
a person makes by choosing it — and the task runs as a new conversation in
that project's own checkout. The agent's id is chosen before it is created and
kept on the receipt, so a restart between the two does not make a second one:
creating with an id that exists returns that agent.
*/
async function projectAgent(
    client: KissopenAgentDaemonClient,
    receipt: Receipt,
): Promise<string | { failure: string }> {
    const path = receipt.project_path!;
    const trimmed = (candidate: string) => candidate.replace(/\/+$/u, "");
    const same = (candidate: string | undefined) =>
        candidate !== undefined && trimmed(candidate) === trimmed(path);
    const listed = await daemonJson<{
        projects?: { id: string; status?: string; compute?: { path?: string } }[];
    }>(client, "GET", "/v0/projects");
    let project = listed.body?.projects?.find(
        (candidate) => candidate.status !== "archived" && same(candidate.compute?.path),
    );
    if (!project) {
        const made = await daemonJson<{ project?: { id: string } }>(
            client,
            "POST",
            "/v0/projects",
            {
                path,
            },
        );
        if (made.status >= 300 || !made.body?.project)
            return { failure: t("这台电脑上打不开目录 {path}", { path }) };
        project = made.body.project;
    }
    const projectId = project.id;
    const workspaces = await daemonJson<{
        workspaces?: { id: string; projectId: string; parentId: string | null; kind?: string }[];
    }>(client, "GET", `/v0/workspaces?projectId=${encodeURIComponent(projectId)}`);
    const rows = (workspaces.body?.workspaces ?? []).filter((w) => w.projectId === projectId);
    const root =
        rows.find((w) => w.kind === "root") ?? rows.find((w) => w.parentId === null) ?? rows[0];
    if (!root) return { failure: t("目录 {path} 还没有可用的工作区", { path }) };
    let agentId = receipt.agent_id;
    if (!agentId) {
        agentId = identifier();
        await receiptChange(receipt.run_id, (stored) => {
            stored.agent_id = agentId!;
        });
    }
    const created = await daemonJson<{ agent?: { id: string } }>(client, "POST", "/v0/agents", {
        workspaceId: root.id,
        title: receipt.name || t("一项计划任务"),
        id: agentId,
    });
    if (created.status >= 300 || !created.body?.agent)
        return {
            failure: t("无法在 {path} 里开始一段对话（{status}）", {
                path,
                status: created.status,
            }),
        };
    return created.body.agent.id;
}

/** A fresh identifier in the Agent's format: lowercase, letter first, 24 long. */
function identifier(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = randomBytes(24);
    return [...bytes]
        .map((byte, index) => alphabet[index === 0 ? byte % 26 : byte % alphabet.length]!)
        .join("");
}

/** Every field the send API insists on, present and set. */
function modeComplete(
    mode: Record<string, unknown> | null | undefined,
): mode is Record<string, unknown> {
    return (
        !!mode &&
        ["providerId", "modelId", "effort", "permissionMode"].every(
            (field) => mode[field] !== undefined && mode[field] !== null,
        )
    );
}

/** The last thing said in one role, cut to what a phone can show. */
function lastSaid(messages: readonly TranscriptMessage[], role: string): string {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index]!;
        if (message.role !== role) continue;
        const text = (message.content ?? [])
            .map((block) => block.text ?? "")
            .filter(Boolean)
            .join("\n")
            .trim();
        if (text) return text.length > 2000 ? text.slice(0, 2000) : text;
    }
    return "";
}

/**
 * What a person sees in the conversation in place of a scheduled run's prompt:
 * which run it was, never the instructions the assistant is given. The cloud
 * gateway labels its runs the same way.
 */
export function scheduledRunLabel(
    kind: "task" | "board" | "analysis" | "card" | undefined,
    name: string | null | undefined,
): string {
    switch (kind) {
        case "board":
            return t("计划任务：构建项目看板");
        case "analysis":
            return t("资料分析");
        case "card":
            return name ? t("处理看板卡片：{name}", { name }) : t("处理看板卡片");
        default:
            return name ? t("计划任务：{name}", { name }) : t("计划任务");
    }
}

/**
 * What the assistant is told when a scheduled task fires: that the moment has
 * come and it should act, not arrange — read as a request, it set about
 * scheduling the task instead of doing it — and that nobody is here to answer
 * a question, so it must not ask one. The cloud gateway words it the same way.
 */
export function scheduledTaskText(name: string | null | undefined, instruction: string): string {
    const head = `${name ? `【计划任务：${name}】` : ""}现在到了计划任务的执行时间，请直接去做：`;
    return `${head}\n${instruction}\n\n这是定时自动触发的，此刻没有人在旁边，也不会有人回答你的提问：不要发起提问，缺什么信息就在回复里说明并结束；做完把结果说清楚。`;
}

/** One of a project's conversations, as a board build is told about it. */
interface ProjectConversation {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: number;
}

/*
The project's own conversations, newest first, for a board build to read: the
active top-level ones its root workspace carries, less the build itself. A
project that cannot be read gives none, and the build works from its files.
*/
async function projectConversations(
    client: KissopenAgentDaemonClient,
    path: string,
    buildId: string,
): Promise<ProjectConversation[]> {
    const trimmed = (candidate: string) => candidate.replace(/\/+$/u, "");
    const listed = await daemonJson<{
        projects?: { id: string; status?: string; compute?: { path?: string } }[];
    }>(client, "GET", "/v0/projects").catch(() => undefined);
    const project = listed?.body?.projects?.find(
        (candidate) =>
            candidate.status !== "archived" &&
            candidate.compute?.path !== undefined &&
            trimmed(candidate.compute.path) === trimmed(path),
    );
    if (!project) return [];
    // A project id answers with the project's root workspace, which embeds its
    // active top-level agents.
    const root = await daemonJson<{
        workspace?: {
            agents?: {
                id: string;
                title?: string | null;
                updatedAt?: number;
                archivedAt?: number | null;
                userVisible?: boolean;
            }[];
        };
    }>(client, "GET", `/v0/workspaces/${encodeURIComponent(project.id)}`).catch(() => undefined);
    return (root?.body?.workspace?.agents ?? [])
        .filter((agent) => agent.id !== buildId && !agent.archivedAt && agent.userVisible !== false)
        .map((agent) => ({
            id: agent.id,
            title: agent.title?.trim() || "未命名对话",
            updatedAt: agent.updatedAt ?? 0,
        }))
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 30);
}

/**
 * What the agent is told when a project's board is due to be built.
 *
 * The board is a file the agent writes in the project, `.kissopen/board.json`,
 * and the desktop draws it: the format below is the contract between the two,
 * and the desktop reads it back with the same limits. The agent chooses which
 * blocks the project needs; nothing about a project is decided here.
 */
export function boardBuildText(conversations: readonly ProjectConversation[], at: Date): string {
    const roster = conversations.length
        ? conversations
              .map(
                  (conversation) =>
                      `- ${conversation.id}：${conversation.title}（最近更新 ${new Date(conversation.updatedAt).toISOString().slice(0, 16).replace("T", " ")}）`,
              )
              .join("\n")
        : "（这个项目还没有对话）";
    return `【计划任务：构建项目看板】现在到了构建项目看板的时间，请直接去做。今天是 ${at.toISOString().slice(0, 10)}。

你要为当前这个项目（你的工作目录就是项目文件夹）写一份「项目看板」：用户打开项目时第一眼看到的页面，让他一眼知道这个项目是什么、进展到哪、接下来该做什么。每个项目不一样，按这个项目的实际内容决定放哪些区块。

先了解项目：
1. 项目里的对话（最新的在前）。用 read_agent_history 读它们，target 填对话 id；先用 query 或较小的 limit 看要点，不必逐字读完：
${roster}
2. 项目文件夹里的文件：uploads/ 是用户在对话里上传的资料，outputs/ 是做出来的成果，其他文件也看一眼。跳过 .git、node_modules 和大的二进制文件。
3. 如果已有 .kissopen/board.json，读它，在它的基础上更新。
4. 读 .kissopen/project.json：goal（项目目标）、direction（方向）、decisions（用户做过的决定）、cards（每张看板卡片的进展，由负责这张卡片的对话自己写）。cards 里每张卡片的 agent 是负责它的对话 id，用 read_agent_history 读它的进展。
   如果 project.json 不存在，就建一个：{"version":1,"goal":"…","direction":"…","decisions":[],"cards":{}}，goal 不超过 100 字、direction 不超过 200 字，按对话和文件写；已经存在时，只在 goal 或 direction 为空时补上，其他内容（decisions、cards）一律不要改。

然后把看板写到 .kissopen/board.json（没有 .kissopen 目录就建一个）。除了 board.json 和上面说的 project.json，不要改动项目里的其他文件。board.json 是一个 JSON 对象，UTF-8，不要注释，格式如下：
{
  "version": 1,
  "title": "项目的目标或名字，一句话，不超过 20 字",
  "subtitle": "一句话说明这个项目，不超过 40 字",
  "icon": "图标",
  "due": "目标日期，如「10 月 31 日」；不知道就写空字符串",
  "blocks": [ 区块, ... ]
}
区块 4 到 10 个，按重要性排列，每个区块都有 "type" 和 "size"。size 是 "full"（整行）、"wide"（三分之二）、"half"（一半）或 "third"（三分之一），同一行的宽度加起来凑满一行。可用的区块：
- {"type":"focus","size":"wide","id":"卡片 id","state":"todo","eyebrow":"现在最重要的一步","title":"…","detail":"…","action":{"label":"按钮文字，不超过 8 字","prompt":"用户按下后，负责这张卡片的对话要做的事"},"chips":[{"title":"不超过 6 字","icon":"图标"}]}
- {"type":"stats","size":"…","title":"…","items":[{"label":"…","value":"如 $128,400 或 36 项","delta":"如 +8.6%，可为空","trend":"up|down|flat"}]}  （2 到 4 项）
- {"type":"milestones","size":"…","title":"…","note":"一句说明，可为空","items":[{"title":"不超过 8 字","detail":"不超过 14 字","state":"done|current|todo","icon":"图标"}]}  （3 到 6 项）
- {"type":"list","size":"…","title":"如 待你决定 / 风险 / 下一步","badge":"如 2 项待确认，可为空","items":[{"id":"卡片 id","state":"todo","title":"…","detail":"…","tone":"accent|warn|good|quiet","action":{"label":"…","prompt":"…"}}]}  （action 可省略）
- {"type":"progress","size":"…","title":"…","items":[{"label":"…","percent":0-100,"detail":"可为空"}]}
- {"type":"chart","size":"…","title":"…","note":"可为空","kind":"line|bar","unit":"如 $ 或 单，可为空","labels":["…"],"series":[{"name":"…","values":[数字, …]}]}  （每个 series 的 values 个数等于 labels 个数，最多 3 个 series、12 个点）
- {"type":"table","size":"…","title":"…","columns":["…"],"rows":[["…"]]}  （最多 6 列 8 行）
- {"type":"text","size":"…","title":"…","body":"一段话，不超过 300 字"}
- {"type":"files","size":"…","title":"如 最新资料 / 成果","items":[{"name":"文件名","path":"相对项目文件夹的路径，如 outputs/周报.docx","detail":"一句说明"}]}  （最多 6 个）
- {"type":"note","size":"…","title":"如 AI 的提醒","body":"一条建议，不超过 80 字"}
图标只能是 box、doc、chart、check、rocket、calendar、people、flag、mail、money、image、cart、globe、star 之一。

卡片：每个 focus 区块和每个 list 条目都是一张卡片，用户点它会进入专门负责这张卡片的对话。
- 每张卡片都要有 "id" 和 "state"。同一件事沿用旧 board.json 或 project.json 里已有的 id，不要换；新的事用新 id："k" 加 6 位小写字母或数字，如 "k7m2q9x"，同一个看板里不要重复。
- state 是 todo（未开始）、in_progress（进行中）、waiting_material（等用户补资料）、needs_decision（等用户拍板）、done（已完成）之一。project.json 的 cards 里已经写了 state 的卡片，照抄那个 state。
- project.json 的 cards 里每一张不是 done 的卡片（包括 id 以 w- 开头的），都要出现在看板上：还没在 focus 或其他 list 里的，放进一个标题为「进行中 / 等你决定」的 list 区块，沿用它的 id、state 和 title。
- 需要用户拍板或补资料的事，写成 state 为 needs_decision 或 waiting_material 的卡片，detail 写清楚要用户决定或提供什么；不要自己替用户决定。

要求：只写有依据的内容，数字、日期、人名都要来自对话或文件，不要编造；项目内容很少时就少放几个区块，用 focus 请用户说清楚目标。用中文写，简洁具体。

这是定时自动触发的，此刻没有人在旁边，也不会有人回答你的提问：不要发起提问，需要用户的事写成上面说的卡片。写完后用一句话说明看板更新了什么。`;
}
