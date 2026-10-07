import * as React from "react";
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/Avatar";
import { useAllMachines, useAllSessions } from "@/sync/storage";
import type { Machine } from "@/sync/storageTypes";
import { getSessionName } from "@/utils/sessionUtils";
import { KissopenLockup } from "./KissopenLockup";
import { client } from "./api/client";
import type { ProfileUser } from "./api/types";
import { onboardingText as copy } from "@/components/onboarding/BrandScreen";
import { t } from "@/text";

export type MobileDestination =
    | "home"
    | "library"
    | "projects"
    | "work"
    | "schedules"
    | "plugins"
    | "themes";
export const mobileDestinations: {
    key: MobileDestination;
    icon: keyof typeof Ionicons.glyphMap;
    label: () => string;
}[] = [
    { key: "home", icon: "home-outline", label: () => t("common.home") },
    { key: "library", icon: "documents-outline", label: () => t("kissopen.nav.library") },
    { key: "projects", icon: "folder-outline", label: () => t("kissopen.nav.projects") },
    { key: "work", icon: "chatbubbles-outline", label: () => t("kissopen.home.tabWork") },
    { key: "schedules", icon: "time-outline", label: () => t("kissopen.nav.schedules") },
    { key: "plugins", icon: "extension-puzzle-outline", label: () => t("kissopen.nav.plugins") },
    { key: "themes", icon: "shirt-outline", label: () => t("kissopen.themes.title") },
];
export const desktopName = (machine: Machine) =>
    machine.metadata?.displayName || machine.metadata?.host || copy("Computer", "电脑");
type Navigation = {
    destination: MobileDestination;
    machine: Machine | undefined;
    selectMachine: (id: string) => void;
    openMenu: () => void;
};
const Context = React.createContext<Navigation | null>(null);
export const useCommunityMobileNavigation = () => React.useContext(Context);

/** Account-owned chrome; workspace content remains owned by the selected desktop. */
export function CommunityMobileShell({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    // Changing identity unmounts the drawer, selection and private previews.
    return (
        <AccountShell key={auth.account?.id || auth.credentials?.kissopenUserId || "signed-out"}>
            {children}
        </AccountShell>
    );
}
function AccountShell({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const machines = useAllMachines({ includeOffline: true });
    const sessions = useAllSessions();
    const [selected, selectMachine] = React.useState<string>("");
    const machine =
        machines.find((m) => m.id === selected) || machines.find((m) => m.active) || machines[0];
    const [destination, setDestination] = React.useState<MobileDestination>("home");
    const [open, setOpen] = React.useState(false);
    const [visible, setVisible] = React.useState(false);
    const [profile, setProfile] = React.useState<ProfileUser>();
    const progress = React.useRef(new Animated.Value(0)).current;
    const drawerWidth = Math.min(360, width * 0.86);
    React.useEffect(() => {
        if (open) setVisible(true);
        Animated.timing(progress, {
            toValue: open ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished && !open) setVisible(false);
        });
        return () => progress.stopAnimation();
    }, [open, progress]);
    React.useEffect(() => {
        if (!auth.isAuthenticated) return;
        let alive = true;
        void client
            .profile()
            .then((p) => {
                if (alive) setProfile(p.user);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [pathname, auth.isAuthenticated]);
    React.useEffect(() => {
        if (auth.isAuthenticated) void client.me().catch(() => undefined);
    }, [auth.isAuthenticated]);
    const navigate = (next: MobileDestination) => {
        setDestination(next);
        setOpen(false);
        router.navigate("/");
    };
    const recent = sessions
        .filter((s) => machine && s.metadata?.machineId === machine.id)
        .slice(0, 12);
    const name =
        profile?.display_name ||
        profile?.username ||
        auth.account?.name ||
        auth.account?.username ||
        copy("Your account", "我的账号");
    return (
        <Context.Provider
            value={{ destination, machine, selectMachine, openMenu: () => setOpen(true) }}
        >
            {children}
            {visible && auth.isAuthenticated && (
                <View
                    style={styles.overlay}
                    accessibilityViewIsModal
                    onAccessibilityEscape={() => setOpen(false)}
                >
                    <Animated.View style={[styles.scrim, { opacity: progress }]}>
                        <Pressable
                            style={styles.fill}
                            onPress={() => setOpen(false)}
                            accessibilityRole="button"
                            accessibilityLabel={t("kissopen.nav.closeMenu")}
                        />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.drawer,
                            {
                                width: drawerWidth,
                                paddingTop: insets.top,
                                transform: [
                                    {
                                        translateX: progress.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-drawerWidth, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.brand}>
                            <Pressable
                                onPress={() => navigate("home")}
                                accessibilityRole="button"
                                accessibilityLabel={t("common.home")}
                            >
                                <KissopenLockup height={23} />
                            </Pressable>
                            <Pressable
                                onPress={() => setOpen(false)}
                                accessibilityRole="button"
                                accessibilityLabel={t("kissopen.nav.closeMenu")}
                                style={styles.control}
                            >
                                <Ionicons
                                    name="close"
                                    size={22}
                                    color={theme.colors.textSecondary}
                                />
                            </Pressable>
                        </View>
                        <ScrollView contentContainerStyle={styles.list}>
                            {mobileDestinations.map((item) => (
                                <Pressable
                                    key={item.key}
                                    onPress={() => navigate(item.key)}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: pathname === "/" && destination === item.key,
                                    }}
                                    style={[
                                        styles.row,
                                        pathname === "/" &&
                                            destination === item.key &&
                                            styles.selected,
                                    ]}
                                >
                                    <Ionicons
                                        name={item.icon}
                                        size={23}
                                        color={theme.colors.text}
                                    />
                                    <Text style={styles.label}>{item.label()}</Text>
                                </Pressable>
                            ))}
                            <Text style={styles.section}>{t("kissopen.drawer.recentChats")}</Text>
                            {recent.map((session) => (
                                <Pressable
                                    key={session.id}
                                    style={styles.row}
                                    onPress={() => {
                                        setOpen(false);
                                        router.navigate(`/session/${session.id}`);
                                    }}
                                    accessibilityRole="button"
                                >
                                    <Ionicons
                                        name="chatbubble-outline"
                                        size={18}
                                        color={theme.colors.textSecondary}
                                    />
                                    <Text style={styles.recent} numberOfLines={1}>
                                        {getSessionName(session)}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <View
                            style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
                        >
                            <Pressable
                                style={styles.identity}
                                onPress={() => {
                                    setOpen(false);
                                    router.push("/settings");
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={name}
                            >
                                <Avatar
                                    id={profile?.id || auth.account?.id || "account"}
                                    size={36}
                                    imageUrl={profile?.avatar_url || null}
                                />
                                <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
                                    {name}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={styles.control}
                                onPress={() => {
                                    setOpen(false);
                                    router.push("/settings");
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t("settings.title")}
                            >
                                <Ionicons
                                    name="settings-outline"
                                    size={23}
                                    color={theme.colors.text}
                                />
                            </Pressable>
                        </View>
                    </Animated.View>
                </View>
            )}
        </Context.Provider>
    );
}
const styles = StyleSheet.create((theme) => ({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 30 },
    fill: { flex: 1 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.42)" },
    drawer: {
        height: "100%",
        backgroundColor: theme.colors.surface,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: theme.colors.divider,
    },
    brand: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 20,
    },
    control: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: 14, paddingBottom: 24 },
    row: {
        minHeight: 52,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 14,
    },
    selected: { backgroundColor: theme.colors.surfaceHigh },
    label: { fontSize: 16, fontWeight: "500", color: theme.colors.text },
    recent: { fontSize: 14, color: theme.colors.textSecondary, flex: 1 },
    section: {
        marginTop: 26,
        marginBottom: 8,
        marginHorizontal: 14,
        color: theme.colors.textSecondary,
        fontSize: 12,
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
    },
    identity: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
    },
}));
