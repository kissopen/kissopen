export * from "./i18n/locale.js";
// Authentication transport and persistence stay in the host adapter. UI uses
// the same provider/profile contract without introducing an auth state system.
export type {
    CommunityProvider,
    CommunityProfile,
    CommunityAuthorization,
    CommunityAuthorizationStatus,
    CommunityLoginResult,
    CommunityLoginHandle,
    CommunitySecurity,
    CommunityTotpSetup,
    CommunitySecurityClient,
} from "@kissopen/kissopen-sync/communityAuth";
export * from "./types.js";
export * from "./transport.js";
export { KissopenAgentApiError, KissopenAgentClient } from "@kissopen/kissopen-agent-client";
export type { ApiErrorBody, KissopenAgentClientOptions } from "@kissopen/kissopen-agent-client";
export * as kissopenAgentProtocol from "@kissopen/kissopen-agent-client";
export * from "./kissopenAgentConnection/index.js";
export { type DeepReadonly } from "./deepReadonly.js";
export * from "./conversation/conversationAuthor.js";
export * from "./conversation/conversationEntries.js";
export * from "./conversation/conversationEntry.js";
export * from "./conversation/conversationSummary.js";
export * from "./conversation/conversationTabsStore.js";
export * from "./conversation/conversationStartStore.js";
export * from "./conversation/inlineImageSize.js";
export * from "./conversation/loadable.js";
export * from "./conversation/scheduledTaskOutcome.js";
export * from "./appearance/appearanceStore.js";
export * from "./commandPalette/commandPaletteStore.js";
export * from "./experiments/experimentsStore.js";
export * from "./titleShimmer/titleShimmerStore.js";
export * from "./modules/composer/composerState.js";
export * from "./modules/terminal/terminalState.js";
export * from "./onboarding/welcomeStore.js";
export * from "./onboarding/kissopenMobileOnboardingStore.js";
export * from "./kissopenAgent/kissopenAgentChatStore.js";
export * from "./kissopenAgent/kissopenAgentClient.js";
export * from "./kissopenAgent/kissopenAgentClock.js";
export * from "./kissopenAgent/kissopenAgentConnection.js";
export * from "./kissopenAgent/kissopenAgentConnectionsStore.js";
export * from "./kissopenAgent/kissopenAgentNodeStore.js";
export * from "./kissopenAgent/kissopenAgentOnboardingStore.js";
export * from "./kissopenAgent/kissopenAgentDebugLogStore.js";
export * from "./kissopenAgent/kissopenAgentConversationAuthors.js";
export * from "./kissopenAgent/kissopenAgentConversationProject.js";
export * from "./kissopenAgent/kissopenAgentGroupAccess.js";
export * from "./kissopenAgent/kissopenAgentHost.js";
export * from "./kissopenAgent/kissopenAgentIntegrationStore.js";
export * from "./kissopenAgent/kissopenAgentCloudStore.js";
export * from "./kissopenAgent/kissopenAgentTeamsStore.js";
export * from "./kissopenAgent/kissopenAgentInboxStore.js";
export * from "./kissopenAgent/kissopenAgentInstructionsStore.js";
export * from "./kissopenAgent/kissopenAgentBotSettings.js";
export * from "./kissopenAgent/kissopenAgentDocumentConversion.js";
export * from "./kissopenAgent/kissopenAgentFileUpload.js";
export * from "./kissopenAgent/kissopenAgentMenusStore.js";
export * from "./kissopenAgent/kissopenAgentModelStore.js";
export * from "./kissopenAgent/kissopenAgentNavigationOrderStore.js";
export * from "./kissopenAgent/kissopenAgentPanelStore.js";
export * from "./kissopenAgent/kissopenAgentProjectGroupProject.js";
export * from "./kissopenAgent/kissopenAgentProjectRegistration.js";
export * from "./kissopenAgent/kissopenAgentProfileStore.js";
export * from "./kissopenAgent/kissopenAgentProviderUsageStore.js";
export * from "./kissopenAgent/kissopenAgentProvidersStore.js";
export * from "./kissopenAgent/kissopenAgentSecurityPolicyStore.js";
export * from "./kissopenAgent/kissopenAgentSecretsStore.js";
export * from "./kissopenAgent/kissopenAgentSessionListStore.js";
export * from "./kissopenAgent/kissopenAgentSettingsStore.js";
export * from "./kissopenAgent/kissopenAgentSidebarCollapseStore.js";
export * from "./kissopenAgent/kissopenAgentSidebarVisibilityStore.js";
export * from "./kissopenAgent/kissopenAgentSupport.js";
export * from "./kissopenAgent/kissopenAgentTerminalStore.js";
export * from "./kissopenAgent/kissopenAgentHostServices.js";
export * from "./kissopenAgent/kissopenAgentTypes.js";
export * from "./kissopenAgent/kissopenAgentWindowStore.js";
export * from "./kissopenAgent/kissopenAgentWorkspaceMemory.js";
export * from "./kissopenAgent/kissopenAgentWorkspaceStore.js";
export * from "./kissopenAgent/kissopenAgentBoard.js";
export * from "./kissopenAgent/projectBoardsStore.js";
export * from "./kissopenAgent/kissopenAgentProjectState.js";
export * from "./kissopenAgent/kissopenAgentHomeDigest.js";
export * from "./kissopenAgent/kissopenAgentViewPreferences.js";

export {
    KissopenStore,
    type KissopenSnapshot,
    type KissopenTransport,
    type KissopenTab,
    type KissopenBoardPlace,
    type KissopenBoardTiming,
    type KissopenBoardSubmission,
    type KissopenProjectAnalysis,
    type KissopenCheckout,
    type KissopenInvite,
    type ThemeDraft,
    themeEffective,
    type KissopenInviteStatus,
    kissopenBoardKey,
} from "./kissopen/kissopenStore";

/*
The server's own contract, generated from internal/api.

Re-exported so a surface outside this package writes against the same shapes
the server is built from, rather than a hand-kept copy that drifts from it.
*/
export type * from "./kissopen/api.gen.js";
export { LocalPluginsStore, type LocalPluginsSnapshot } from "./kissopen/localPluginsStore.js";
export {
    billingHistoryStoreCreate,
    type BillingHistoryStore,
    type BillingHistoryKind,
    type BillingHistorySnapshot,
} from "./kissopen/billingHistoryStore.js";
export { fileThumbnailStoreCreate } from "./files/fileThumbnailStore.js";
export {
    localLibraryStoreCreate,
    type LocalLibraryStore,
    type LocalLibrarySource,
} from "./files/localLibraryStore.js";
export {
    DICTATION_WAVE_BARS,
    dictationStoreCreate,
    type DictationSnapshot,
    type DictationStatus,
    type DictationStore,
} from "./dictation/dictationStore.js";
