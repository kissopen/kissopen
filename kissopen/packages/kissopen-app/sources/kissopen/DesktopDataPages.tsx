import * as React from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { createId } from "@paralleldrive/cuid2";
import type { DesktopData, DesktopRequest } from "@kissopen/kissopen-sync/desktopManagement";
import { decodeBase64 } from "@/encryption/base64";
import { ProjectGroup } from "@/components/ProjectGroup";
import { useSessionListViewData } from "@/sync/storage";
import { desktopRead, desktopUnavailable } from "./desktopManagement";
import { onboardingText as copy } from "@/components/onboarding/BrandScreen";

type Data<K extends DesktopData["kind"]> = Extract<DesktopData, { kind: K }>;
/** Foreground reads only. A slow read never overlaps its next polling tick. */
function useDesktopData(machineId: string, request: DesktopRequest, enabled = true) {
    const focused = useIsFocused();
    const [data, setData] = React.useState<DesktopData>();
    const [error, setError] = React.useState("");
    const reload = React.useRef<() => void>(() => undefined);
    const pending = React.useRef(false);
    const encoded = JSON.stringify(request);
    React.useEffect(() => {
        let alive = true;
        const load = async () => {
            if (
                !alive ||
                pending.current ||
                !enabled ||
                !focused ||
                AppState.currentState !== "active"
            )
                return;
            pending.current = true;
            try {
                const result = await desktopRead(machineId, JSON.parse(encoded));
                if (alive) {
                    setData(result);
                    setError("");
                }
            } catch (e) {
                if (alive)
                    setError(
                        e instanceof Error && !/RPC|respond|connect|encryption/i.test(e.message)
                            ? e.message
                            : desktopUnavailable(),
                    );
            } finally {
                pending.current = false;
            }
        };
        reload.current = () => {
            void load();
        };
        void load();
        const timer = setInterval(() => void load(), 5000);
        const app = AppState.addEventListener("change", (state) => {
            if (state === "active") void load();
        });
        return () => {
            alive = false;
            clearInterval(timer);
            app.remove();
            reload.current = () => undefined;
        };
    }, [machineId, encoded, focused, enabled]);
    return { data, error, reload: () => reload.current() };
}
function Notice({ text, loading = false }: { text: string; loading?: boolean }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.notice}>
            {loading ? <ActivityIndicator color={theme.colors.textSecondary} /> : null}
            <Text style={styles.muted}>{text}</Text>
        </View>
    );
}
function Pending({ error }: { error: string }) {
    return (
        <Notice
            loading={!error}
            text={error || copy("Reading from your computer…", "正在读取电脑上的数据…")}
        />
    );
}
function Action({
    label,
    icon,
    onPress,
    disabled,
}: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
}) {
    const { theme } = useUnistyles();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            style={[styles.action, disabled && { opacity: 0.45 }]}
        >
            {icon && <Ionicons name={icon} size={17} color={theme.colors.text} />}
            <Text style={styles.actionText}>{label}</Text>
        </Pressable>
    );
}
const date = (value: number) => (value ? new Date(value).toLocaleString() : "—");
const taskStatus = (status: string) =>
    ({
        active: copy("Active", "已启用"),
        paused: copy("Paused", "已暂停"),
        completed: copy("Completed", "已完成"),
        failed: copy("Failed", "失败"),
        running: copy("Running", "执行中"),
        queued: copy("Queued", "排队中"),
        pending: copy("Pending", "待执行"),
        cancelled: copy("Cancelled", "已取消"),
    })[status] || status;

export function DesktopProjects({ machineId }: { machineId: string }) {
    const resource = useDesktopData(machineId, { action: "library.projects" });
    const groups = useSessionListViewData();
    if (resource.data?.kind !== "projects") return <Pending error={resource.error} />;
    return (
        <ScrollView contentContainerStyle={styles.content}>
            {!!resource.error && <Notice text={resource.error} />}
            {!resource.data.projects.length && (
                <Notice
                    text={copy(
                        "No local projects on this computer yet.",
                        "这台电脑上还没有本地项目。",
                    )}
                />
            )}
            {resource.data.projects.map((project) => {
                const group = groups?.find(
                    (g) =>
                        g.type === "project" &&
                        g.project.machineId === machineId &&
                        g.project.id === project.id,
                );
                return group?.type === "project" ? (
                    <ProjectGroup key={project.id} project={group.project} />
                ) : (
                    <View key={project.id} style={styles.card}>
                        <Text style={styles.title}>{project.name}</Text>
                        <Text style={styles.muted}>
                            {copy(
                                "No conversations yet. Open this project on your computer to start work.",
                                "暂无对话。可在电脑上打开此项目开始工作。",
                            )}
                        </Text>
                    </View>
                );
            })}
        </ScrollView>
    );
}

export function DesktopPlugins({ machineId }: { machineId: string }) {
    const resource = useDesktopData(machineId, { action: "plugins.list" });
    const [selected, setSelected] = React.useState<string>();
    if (resource.data?.kind !== "plugins") return <Pending error={resource.error} />;
    const plugins = resource.data.plugins.filter((p) => !p.removed);
    const chosen = plugins.find((p) => p.id === selected);
    return (
        <ScrollView contentContainerStyle={styles.content}>
            {!!resource.error && <Notice text={resource.error} />}
            {resource.data.applying && (
                <Notice
                    loading
                    text={copy("Applying plugin changes on the computer…", "电脑正在应用插件改动…")}
                />
            )}
            {!!resource.data.error && (
                <Notice
                    text={copy(
                        "Some plugins could not be applied. Check Plugins on your computer.",
                        "部分插件未能应用，请在电脑上的插件页查看。",
                    )}
                />
            )}
            {chosen ? (
                <>
                    <Action
                        label={copy("All plugins", "全部插件")}
                        icon="arrow-back"
                        onPress={() => setSelected(undefined)}
                    />
                    <View style={styles.card}>
                        <Text style={styles.title}>{chosen.name}</Text>
                        <Text style={styles.muted}>{chosen.description}</Text>
                        <Text style={styles.body}>{chosen.version}</Text>
                        <Text style={styles.muted}>
                            {copy("Skills", "技能")} · {chosen.skills}　MCP · {chosen.servers}
                        </Text>
                        <Text style={styles.body}>
                            {chosen.active
                                ? copy("In use", "使用中")
                                : chosen.enabled
                                  ? copy("Enabled", "已启用")
                                  : copy("Disabled", "已关闭")}
                        </Text>
                        {!!chosen.unsupported.length && (
                            <Text style={styles.muted}>
                                {copy("Not supported on this computer", "当前电脑不支持")} ·{" "}
                                {chosen.unsupported.join(", ")}
                            </Text>
                        )}
                    </View>
                </>
            ) : (
                plugins.map((plugin) => (
                    <Pressable
                        key={plugin.id}
                        style={styles.card}
                        accessibilityRole="button"
                        onPress={() => setSelected(plugin.id)}
                    >
                        <View style={styles.line}>
                            <Text style={[styles.title, { flex: 1 }]}>{plugin.name}</Text>
                            <Text style={styles.badge}>
                                {plugin.active
                                    ? copy("In use", "使用中")
                                    : plugin.enabled
                                      ? copy("Enabled", "已启用")
                                      : copy("Disabled", "已关闭")}
                            </Text>
                        </View>
                        <Text style={styles.muted} numberOfLines={3}>
                            {plugin.description}
                        </Text>
                        <Text style={styles.muted}>
                            {plugin.version} · {copy("Skills", "技能")} {plugin.skills} · MCP{" "}
                            {plugin.servers}
                        </Text>
                    </Pressable>
                ))
            )}
            {!plugins.length && (
                <Notice
                    text={copy(
                        "No installed plugins on this computer. Install plugins from its Plugins page.",
                        "这台电脑还没有安装插件。请在电脑的插件页安装。",
                    )}
                />
            )}
        </ScrollView>
    );
}

export function DesktopSchedules({ machineId }: { machineId: string }) {
    const [history, setHistory] = React.useState<string>();
    const resource = useDesktopData(machineId, { action: "schedules.list" }, !history);
    const [busy, setBusy] = React.useState("");
    const [notice, setNotice] = React.useState("");
    const runIds = React.useRef(new Map<string, string>());
    const alive = React.useRef(true);
    const locked = React.useRef(false);
    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const act = async (request: DesktopRequest, id: string) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(id);
        setNotice("");
        if (request.action === "schedule.run") {
            request = { ...request, runId: runIds.current.get(id) || request.runId };
            runIds.current.set(id, request.runId);
        }
        try {
            await desktopRead(machineId, request);
            if (request.action === "schedule.run") runIds.current.delete(id);
            if (alive.current) {
                setNotice(copy("Sent to your computer.", "已发送到电脑。"));
                resource.reload();
            }
        } catch {
            if (alive.current)
                setNotice(
                    copy(
                        "Could not confirm this change. Check the latest status before trying again.",
                        "暂时无法确认操作结果，请查看最新状态后再操作。",
                    ),
                );
        } finally {
            locked.current = false;
            if (alive.current) setBusy("");
        }
    };
    if (history)
        return (
            <ScheduleHistory
                machineId={machineId}
                id={history}
                onBack={() => setHistory(undefined)}
            />
        );
    if (resource.data?.kind !== "schedules") return <Pending error={resource.error} />;
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.muted}>
                {copy(
                    "Executed locally on this computer. Keep it awake and KissOpen running.",
                    "任务由这台电脑本地执行，请保持电脑唤醒和 KissOpen 运行。",
                )}
            </Text>
            {!!resource.error && <Notice text={resource.error} />}
            {!!notice && <Notice text={notice} />}
            {!resource.data.schedules.length && (
                <Notice
                    text={copy(
                        "No scheduled tasks yet. Tell your local assistant what to do and when.",
                        "还没有定时任务。在本地助手对话中说明要做什么、什么时候执行即可创建。",
                    )}
                />
            )}
            {resource.data.schedules.map((task) => (
                <View key={task.id} style={styles.card}>
                    <View style={styles.line}>
                        <Text style={[styles.title, { flex: 1 }]}>{task.name}</Text>
                        <Text style={styles.badge}>{taskStatus(task.status)}</Text>
                    </View>
                    <Text style={styles.body}>{task.instruction}</Text>
                    {!!task.project_name && <Text style={styles.muted}>{task.project_name}</Text>}
                    <Text style={styles.muted}>
                        {task.recurrence === "interval"
                            ? copy(
                                  `Every ${task.interval_minutes} minutes`,
                                  `每 ${task.interval_minutes} 分钟`,
                              )
                            : copy("Next run", "下次执行")}{" "}
                        · {date(task.next_run_at)} · {task.timezone}
                    </Text>
                    {!!task.last_run && (
                        <Text style={styles.muted}>
                            {taskStatus(task.last_run.status)} ·{" "}
                            {task.last_run.summary || task.last_run.error}
                        </Text>
                    )}
                    <View style={styles.actions}>
                        <Action
                            label={copy("Run now", "立即运行")}
                            icon="play-outline"
                            disabled={!!busy}
                            onPress={() =>
                                void act(
                                    { action: "schedule.run", id: task.id, runId: createId() },
                                    task.id,
                                )
                            }
                        />
                        {["active", "paused"].includes(task.status) && (
                            <Action
                                disabled={!!busy}
                                label={
                                    task.status === "active"
                                        ? copy("Pause", "暂停")
                                        : copy("Resume", "继续")
                                }
                                onPress={() =>
                                    void act(
                                        {
                                            action: "schedule.status",
                                            id: task.id,
                                            status: task.status === "active" ? "paused" : "active",
                                        },
                                        task.id,
                                    )
                                }
                            />
                        )}
                        <Action
                            label={copy("History", "运行记录")}
                            icon="time-outline"
                            onPress={() => setHistory(task.id)}
                        />
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}
function ScheduleHistory({
    machineId,
    id,
    onBack,
}: {
    machineId: string;
    id: string;
    onBack: () => void;
}) {
    const resource = useDesktopData(machineId, { action: "schedule.runs", id });
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Action
                icon="arrow-back"
                label={copy("Scheduled tasks", "定时任务")}
                onPress={onBack}
            />
            {resource.data?.kind !== "runs" ? (
                <Pending error={resource.error} />
            ) : (
                <>
                    {!!resource.error && <Notice text={resource.error} />}
                    {!resource.data.runs.length && (
                        <Notice text={copy("No runs yet.", "暂无运行记录。")} />
                    )}
                    {resource.data.runs.map((run) => (
                        <View key={run.id} style={styles.card}>
                            <Text style={styles.title}>{taskStatus(run.status)}</Text>
                            <Text style={styles.muted}>
                                {date(run.started_at || run.scheduled_for)}
                            </Text>
                            <Text style={styles.body}>
                                {run.summary ||
                                    run.error ||
                                    copy("Waiting for results.", "等待执行结果。")}
                            </Text>
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );
}

export function DesktopLibrary({ machineId }: { machineId: string }) {
    const [project, setProject] = React.useState<{ id: string; name: string }>();
    const resource = useDesktopData(machineId, { action: "library.projects" }, !project);
    if (project)
        return (
            <ProjectFiles
                machineId={machineId}
                project={project}
                onBack={() => setProject(undefined)}
            />
        );
    if (resource.data?.kind !== "projects") return <Pending error={resource.error} />;
    return (
        <ScrollView contentContainerStyle={styles.content}>
            {!!resource.error && <Notice text={resource.error} />}
            <Text style={styles.muted}>
                {copy(
                    "Files stay on your computer. Choose a project to browse its files.",
                    "文件保存在电脑上。选择项目查看其中的资料。",
                )}
            </Text>
            {resource.data.projects.map((p) => (
                <Action
                    key={p.id}
                    icon="folder-outline"
                    label={p.name}
                    onPress={() => setProject(p)}
                />
            ))}
            {!resource.data.projects.length && (
                <Notice text={copy("No local project files yet.", "暂无本地项目资料。")} />
            )}
        </ScrollView>
    );
}
function ProjectFiles({
    machineId,
    project,
    onBack,
}: {
    machineId: string;
    project: { id: string; name: string };
    onBack: () => void;
}) {
    const [path, setPath] = React.useState("");
    const [cursor, setCursor] = React.useState<string>();
    return (
        <Directory
            key={`${project.id}:${path}:${cursor || ""}`}
            machineId={machineId}
            project={project}
            path={path}
            cursor={cursor}
            onNext={setCursor}
            onNavigate={(next) => {
                setPath(next);
                setCursor(undefined);
            }}
            onBack={onBack}
        />
    );
}
function Directory({
    machineId,
    project,
    path,
    cursor,
    onNext,
    onNavigate,
    onBack,
}: {
    machineId: string;
    project: { id: string; name: string };
    path: string;
    cursor?: string;
    onNext: (cursor?: string) => void;
    onNavigate: (path: string) => void;
    onBack: () => void;
}) {
    const [file, setFile] = React.useState<Data<"file">>();
    const resource = useDesktopData(
        machineId,
        { action: "library.directory", projectId: project.id, path, ...(cursor ? { cursor } : {}) },
        !file,
    );
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");
    const alive = React.useRef(true);
    const locked = React.useRef(false);
    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const read = async (filePath: string) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await desktopRead(machineId, {
                action: "library.read",
                projectId: project.id,
                path: filePath,
            });
            if (alive.current && result.kind === "file") setFile(result);
        } catch (e) {
            if (alive.current) setError(e instanceof Error ? e.message : desktopUnavailable());
        } finally {
            locked.current = false;
            if (alive.current) setBusy(false);
        }
    };
    if (file) return <FilePreview file={file} onBack={() => setFile(undefined)} />;
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Action
                icon="arrow-back"
                label={path ? copy("Parent folder", "上级目录") : copy("All projects", "全部项目")}
                onPress={() =>
                    path ? onNavigate(path.split("/").slice(0, -1).join("/")) : onBack()
                }
            />
            <Text style={styles.title}>{project.name}</Text>
            {!!path && <Text style={styles.muted}>{path}</Text>}
            {!!error && <Notice text={error} />}
            {busy && <Notice loading text={copy("Opening file…", "正在打开文件…")} />}
            {resource.data?.kind !== "directory" ? (
                <Pending error={resource.error} />
            ) : (
                <>
                    {!!resource.error && <Notice text={resource.error} />}
                    {resource.data.entries.map((entry) => (
                        <View key={entry.path} style={styles.fileRow}>
                            <Action
                                disabled={busy || !["file", "directory"].includes(entry.type)}
                                icon={
                                    entry.type === "directory"
                                        ? "folder-outline"
                                        : "document-outline"
                                }
                                label={entry.name}
                                onPress={() =>
                                    entry.type === "directory"
                                        ? onNavigate(entry.path)
                                        : void read(entry.path)
                                }
                            />
                            {entry.type === "file" && (
                                <Text style={styles.muted}>{Math.ceil(entry.size / 1024)} KB</Text>
                            )}
                        </View>
                    ))}
                    {!resource.data.entries.length && (
                        <Notice text={copy("This folder is empty.", "此目录暂无资料。")} />
                    )}
                    {resource.data.nextCursor && (
                        <Action
                            label={copy("Next page", "下一页")}
                            onPress={() => onNext((resource.data as Data<"directory">).nextCursor!)}
                        />
                    )}
                    {cursor && (
                        <Action
                            label={copy("First page", "第一页")}
                            onPress={() => onNext(undefined)}
                        />
                    )}
                </>
            )}
        </ScrollView>
    );
}
function FilePreview({ file, onBack }: { file: Data<"file">; onBack: () => void }) {
    const imageType = /\.(png|jpe?g|gif|webp)$/i.exec(file.name)?.[1].toLowerCase();
    let text: string | undefined;
    if (!imageType) {
        try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(file.content));
            if (text.includes("\u0000")) text = undefined;
        } catch {
            /* Binary files are not rendered as text. */
        }
    }
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Action icon="arrow-back" label={copy("Files", "资料")} onPress={onBack} />
            <Text style={styles.title}>{file.name}</Text>
            {imageType ? (
                <Image
                    source={{
                        uri: `data:image/${imageType === "jpg" ? "jpeg" : imageType};base64,${file.content}`,
                    }}
                    contentFit="contain"
                    style={{ height: 360, width: "100%" }}
                />
            ) : text !== undefined ? (
                <Text selectable style={styles.body}>
                    {text}
                </Text>
            ) : (
                <Notice
                    text={copy(
                        "This format cannot be previewed here. Open it on your computer.",
                        "此格式暂不支持手机预览，请在电脑上打开。",
                    )}
                />
            )}
        </ScrollView>
    );
}
const styles = StyleSheet.create((theme) => ({
    content: { padding: 20, paddingBottom: 40, gap: 14, flexGrow: 1 },
    card: {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.divider,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        padding: 18,
        gap: 10,
    },
    title: { color: theme.colors.text, fontSize: 17, fontWeight: "600" },
    body: { color: theme.colors.text, fontSize: 15, lineHeight: 23 },
    muted: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 21 },
    notice: { paddingVertical: 20, paddingHorizontal: 12, gap: 12 },
    line: { flexDirection: "row", alignItems: "center", gap: 12 },
    badge: { color: theme.colors.textSecondary, fontSize: 12, flexShrink: 0 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    action: {
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: theme.colors.surfaceHigh,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    actionText: { fontSize: 14, color: theme.colors.text, flexShrink: 1 },
    fileRow: { gap: 4 },
}));
