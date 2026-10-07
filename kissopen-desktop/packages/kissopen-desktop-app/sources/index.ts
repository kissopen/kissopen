import "./styles.css";
export { LocalPluginsView } from "./views/LocalPluginsView";
export { LocalLibraryView } from "./LocalLibraryView";
export { CommunityAccount } from "./auth/communityAccount";
export { AppCommunityAccountBoundary } from "./components/AppCommunityAccountBoundary";
export { useCloudDestinations } from "./cloudDestinations";

export { KissopenAgentPanelBody } from "./AppKissopenAgentView";
export {
    AppKissopenAgentView,
    type AppKissopenAgentDirectorySnapshot,
    type AppKissopenAgentDirectoryStore,
    type AppKissopenAgentEntry,
    type AppKissopenAgentSetup,
    type AppKissopenAgentSession,
    type AppApplicationIdentity,
    type AppKissopenAgentUpdate,
    type AppKissopenAgentViewProps,
} from "./AppKissopenAgentView";
export {
    KissopenAgentVersionContext,
    KissopenAgentVersionProvider,
    useKissopenAgentVersion,
    useKissopenAgentVersionAtLeast,
    type KissopenAgentVersionProviderProps,
} from "./KissopenAgentVersionProvider";
export {
    type AppKissopenAgentDaemonInstall,
    type AppKissopenAgentDaemonRestartReason,
    type AppKissopenAgentDaemonSnapshot,
    type AppKissopenAgentDaemonStore,
    type AppKissopenAgentDaemonVersion,
    type AppKissopenAgentDrainAgent,
    type AppKissopenAgentDrainComponent,
    type AppKissopenAgentDebugSnapshot,
    type AppKissopenAgentDebugStore,
    type AppKissopenAgentDebugTargetSnapshot,
    type AppKissopenAgentProfilerCapabilities,
    type AppKissopenAgentProfilerSnapshot,
    type AppKissopenAgentProfilerStore,
} from "./views/AppKissopenAgentSettingsView";
export {
    kissopenAgentHistoryCreate,
    type KissopenAgentHistoryDocument,
    type KissopenAgentHistoryPersistence,
    type KissopenAgentRouterHistory,
} from "./navigation/kissopenAgentHistory";
export {
    kissopenAgentMemoryHistoryCreate,
    kissopenAgentRouterConversationOpen,
    kissopenAgentRouterCreateOpen,
    kissopenAgentRouterGroupOpen,
    kissopenAgentRouterFileOpen,
    kissopenAgentRouterHomeOpen,
    kissopenAgentRouterGroupForget,
    kissopenAgentRouterCreate,
    type KissopenAgentRouter,
    type KissopenAgentRouterContext,
} from "./navigation/kissopenAgentRouter";
export { DesktopStartupScreen, type DesktopStartupValues } from "kissopen-desktop-ui";
export {
    BrowserTerminalConnection,
    TERMINAL_PROTOCOL,
    terminalSocketUrl,
} from "./browserTerminalConnection";
export { terminalDriverCreate } from "./terminalDriver";
export { ghosttyEmulatorCreate, type TerminalEmulator } from "./ghosttyTerminal";
export { kissopenAgentWelcomeSlides } from "./onboarding/kissopenAgentWelcomeSlides";
export { KissopenView } from "./KissopenView";
