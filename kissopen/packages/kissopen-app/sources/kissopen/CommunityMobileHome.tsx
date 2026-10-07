import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAllMachines, useAllSessions, useIsDataReady } from "@/sync/storage";
import { useNewSessionDraft } from "@/hooks/useNewSessionDraft";
import { getSessionName } from "@/utils/sessionUtils";
import { t } from "@/text";
import { onboardingText as copy } from "@/components/onboarding/BrandScreen";
import {
    desktopName,
    mobileDestinations,
    useCommunityMobileNavigation,
} from "./CommunityMobileShell";
import {
    DesktopLibrary,
    DesktopPlugins,
    DesktopProjects,
    DesktopSchedules,
} from "./DesktopDataPages";
import { ThemesScreen } from "./ThemesScreen";

export function CommunityMobileHome() {
    const navigation = useCommunityMobileNavigation();
    const { theme } = useUnistyles();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const machines = useAllMachines({ includeOffline: true });
    const sessions = useAllSessions();
    const ready = useIsDataReady();
    const [choosing, setChoosing] = React.useState(false);
    if (!navigation) return null;
    const { destination, machine } = navigation;
    const title = mobileDestinations.find((d) => d.key === destination)!.label();
    const recent = sessions.filter((s) => machine && s.metadata?.machineId === machine.id);
    const newChat = () => {
        if (!machine?.active) return;
        useNewSessionDraft.getState().setMachineId(machine.id);
        router.push("/new");
    };
    const sourceIsDesktop = destination !== "themes";
    return (
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <Pressable
                    style={styles.control}
                    onPress={navigation.openMenu}
                    accessibilityRole="button"
                    accessibilityLabel={t("kissopen.nav.openMenu")}
                >
                    <Ionicons name="menu" size={25} color={theme.colors.text} />
                </Pressable>
                <Text style={styles.heading} numberOfLines={1}>
                    {title}
                </Text>
                {["home", "work"].includes(destination) ? (
                    <Pressable
                        style={styles.control}
                        disabled={!machine?.active}
                        onPress={newChat}
                        accessibilityRole="button"
                        accessibilityLabel={t("sidebar.newSession")}
                    >
                        <Ionicons
                            name="create-outline"
                            size={23}
                            color={machine?.active ? theme.colors.text : theme.colors.textSecondary}
                        />
                    </Pressable>
                ) : (
                    <View style={styles.control} />
                )}
            </View>
            <Pressable
                style={styles.source}
                onPress={() => sourceIsDesktop && setChoosing(true)}
                disabled={!sourceIsDesktop}
                accessibilityRole={sourceIsDesktop ? "button" : undefined}
                accessibilityLabel={copy("Choose computer", "选择电脑")}
            >
                <Ionicons
                    name={sourceIsDesktop ? "desktop-outline" : "person-circle-outline"}
                    size={17}
                    color={theme.colors.textSecondary}
                />
                <Text style={styles.sourceText} numberOfLines={1}>
                    {sourceIsDesktop
                        ? machine
                            ? `${desktopName(machine)} · ${machine.active ? copy("Online", "在线") : copy("Offline", "离线")}`
                            : copy("Connect a computer", "连接电脑")
                        : copy("Themes saved to your account", "主题保存在你的账号中")}
                </Text>
                {sourceIsDesktop && (
                    <Ionicons name="chevron-down" size={15} color={theme.colors.textSecondary} />
                )}
            </Pressable>
            <View style={styles.main} key={`${destination}:${machine?.id || "none"}`}>
                {destination === "themes" ? (
                    <ThemesScreen />
                ) : !ready ? (
                    <Empty text={copy("Syncing your workspace…", "正在同步工作区…")} />
                ) : !machine ? (
                    <Empty
                        text={copy(
                            "Connect a computer signed in to this account to access your work.",
                            "连接登录同一账号的电脑，即可查看工作数据。",
                        )}
                        action={() => router.push("/devices/connect")}
                    />
                ) : ["home", "work"].includes(destination) ? (
                    <ScrollView contentContainerStyle={styles.content}>
                        {destination === "home" && (
                            <View style={styles.welcome}>
                                <Text style={styles.welcomeTitle}>
                                    {copy("Pick up where you left off.", "接着电脑上的工作继续。")}
                                </Text>
                                <Text style={styles.secondary}>
                                    {copy(
                                        "Your conversations, files and local tools — on the same computer.",
                                        "对话、资料和本地工具，都来自同一台电脑。",
                                    )}
                                </Text>
                            </View>
                        )}
                        {!machine.active && (
                            <Text style={styles.secondary}>
                                {copy(
                                    "This computer is offline. Synced conversations are available; new messages will need it back online.",
                                    "电脑当前离线，可查看已同步的对话；继续发消息需要电脑在线。",
                                )}
                            </Text>
                        )}
                        {(destination === "home" ? recent.slice(0, 8) : recent).map((session) => (
                            <Pressable
                                style={styles.session}
                                key={session.id}
                                accessibilityRole="button"
                                onPress={() => router.push(`/session/${session.id}`)}
                            >
                                <Ionicons
                                    name="chatbubble-outline"
                                    size={22}
                                    color={theme.colors.textSecondary}
                                />
                                <View style={{ flex: 1, gap: 6 }}>
                                    <Text style={styles.sessionTitle} numberOfLines={2}>
                                        {getSessionName(session)}
                                    </Text>
                                    <Text style={styles.secondary} numberOfLines={1}>
                                        {session.metadata?.project?.name ||
                                            session.metadata?.bot?.name ||
                                            desktopName(machine)}{" "}
                                        ·{" "}
                                        {session.thinking
                                            ? copy("Working", "执行中")
                                            : new Date(session.updatedAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color={theme.colors.textSecondary}
                                />
                            </Pressable>
                        ))}
                        {!recent.length && (
                            <Empty
                                text={copy(
                                    "No conversations on this computer yet.",
                                    "这台电脑上还没有对话。",
                                )}
                            />
                        )}
                    </ScrollView>
                ) : !machine.active ? (
                    <Empty
                        text={copy(
                            "This page reads directly from your computer. Keep KissOpen open there to reconnect automatically.",
                            "此页直接读取电脑上的数据。请保持电脑上的 KissOpen 在线，恢复连接后会自动显示。",
                        )}
                    />
                ) : destination === "library" ? (
                    <DesktopLibrary machineId={machine.id} />
                ) : destination === "projects" ? (
                    <DesktopProjects machineId={machine.id} />
                ) : destination === "schedules" ? (
                    <DesktopSchedules machineId={machine.id} />
                ) : (
                    <DesktopPlugins machineId={machine.id} />
                )}
            </View>
            <Modal
                transparent
                visible={choosing}
                animationType="fade"
                onRequestClose={() => setChoosing(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setChoosing(false)}>
                    <Pressable style={styles.chooser} onPress={() => undefined}>
                        <Text style={[styles.heading, { flex: 0 }]}>
                            {copy("Your computers", "我的电脑")}
                        </Text>
                        <ScrollView style={{ maxHeight: 360 }}>
                            {machines.map((m) => (
                                <Pressable
                                    key={m.id}
                                    style={styles.machine}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: m.id === machine?.id }}
                                    onPress={() => {
                                        navigation.selectMachine(m.id);
                                        setChoosing(false);
                                    }}
                                >
                                    <Ionicons
                                        name="desktop-outline"
                                        size={22}
                                        color={theme.colors.text}
                                    />
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <Text style={styles.sessionTitle} numberOfLines={1}>
                                            {desktopName(m)}
                                        </Text>
                                        <Text style={styles.secondary}>
                                            {m.active
                                                ? copy("Online", "在线")
                                                : copy("Offline", "离线")}
                                        </Text>
                                    </View>
                                    {m.id === machine?.id && (
                                        <Ionicons
                                            name="checkmark"
                                            size={22}
                                            color={theme.colors.text}
                                        />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                        <Pressable
                            style={styles.machine}
                            onPress={() => {
                                setChoosing(false);
                                router.push("/devices/connect");
                            }}
                            accessibilityRole="button"
                        >
                            <Ionicons name="add" size={22} color={theme.colors.text} />
                            <Text style={styles.sessionTitle}>
                                {copy("Connect a computer", "连接电脑")}
                            </Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}
function Empty({ text, action }: { text: string; action?: () => void }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.secondary}>{text}</Text>
            {action && (
                <Pressable style={styles.session} onPress={action} accessibilityRole="button">
                    <Text style={styles.sessionTitle}>
                        {copy("Connect a computer", "连接电脑")}
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
const styles = StyleSheet.create((theme) => ({
    root: { flex: 1, backgroundColor: theme.colors.groupped.background },
    main: { flex: 1, minHeight: 0 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        height: 56,
    },
    control: { height: 44, width: 44, alignItems: "center", justifyContent: "center" },
    heading: { fontSize: 18, fontWeight: "600", color: theme.colors.text, flex: 1 },
    source: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        marginHorizontal: 20,
        marginBottom: 12,
        minHeight: 40,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: theme.colors.surface,
    },
    sourceText: { color: theme.colors.textSecondary, fontSize: 12, flex: 1 },
    content: { padding: 20, paddingBottom: 36, gap: 12, flexGrow: 1 },
    welcome: { paddingVertical: 16, gap: 12 },
    welcomeTitle: { color: theme.colors.text, fontSize: 26, lineHeight: 34, fontWeight: "500" },
    secondary: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 21 },
    session: {
        borderRadius: 14,
        padding: 16,
        backgroundColor: theme.colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
    },
    sessionTitle: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
    empty: { padding: 24, gap: 20 },
    backdrop: { flex: 1, padding: 24, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "center" },
    chooser: { padding: 20, backgroundColor: theme.colors.surface, borderRadius: 20, gap: 18 },
    machine: {
        flexDirection: "row",
        minHeight: 64,
        alignItems: "center",
        gap: 14,
        paddingVertical: 8,
    },
}));
