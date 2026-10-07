import { RoundButton } from "@/components/RoundButton";
import { useAuth } from "@/auth/AuthContext";
import { Text, View, Image, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as React from "react";
import { encodeBase64 } from "@/encryption/base64";
import { authGetToken } from "@/auth/authGetToken";
import { useRouter, Redirect } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { getRandomBytesAsync } from "expo-crypto";
import { useIsLandscape } from "@/utils/responsive";
import { Typography } from "@/constants/Typography";
import { trackAccountCreated, trackAccountRestored } from "@/track";
import { HomeHeaderNotAuth } from "@/components/HomeHeader";
import { MainView } from "@/components/MainView";
import { OnboardingInstall } from "@/components/onboarding/OnboardingInstall";
import { shouldShowFirstRunInstall } from "@/components/onboarding/firstRunOnboarding";
import { useAllMachines, useIsDataReady } from "@/sync/storage";
import { t } from "@/text";
import { isRunningOnMac } from "@/utils/platform";
import { Modal } from "@/modal";
import { appBrand } from "@/appIdentity";
import { CommunityLoginButtons } from "@/components/onboarding/CommunityLoginButtons";
import { communityAccountOrigin } from "@/communityServer";
import { BrandScreen, BrandLockup, brand, brandStyles, onboardingText as copy } from '@/components/onboarding/BrandScreen';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommunityMobileHome } from '@/kissopen/CommunityMobileHome';

// The community entry uses the encrypted self-hosted workspace, not the
// commercial consumer account, dashboard, or automatically provisioned cloud.
// Social authorization binds the same encrypted workspace; key/QR restoration
// remains available for self-hosted deployments and device recovery.
export default function Home() {
  return <WorkHome />;
}

export function WorkHome() {
  const auth = useAuth();
  if (communityAccountOrigin && auth.accountLoading) return <BrandScreen>
    <BrandLockup /><Text style={brandStyles.body}>{auth.accountError || copy('Restoring your sign-in…', '正在恢复登录状态…')}</Text>
  </BrandScreen>;
  if (communityAccountOrigin && auth.account && !auth.isAuthenticated) return <Redirect href="/devices/connect" />;
  // An old QR/key-based session is not an account login. Keep its recovery
  // material, but show the real account entry instead of a dead pairing screen.
  if (!auth.isAuthenticated || (communityAccountOrigin && !auth.credentials?.kissopenUserId)) {
    return <NotAuthenticated />;
  }
  return <Authenticated />;
}

function Authenticated() {
  const isDataReady = useIsDataReady();
  const machines = useAllMachines({ includeOffline: true });
  // Hosted Web and mobile use the same account-owned navigation and desktop
  // data pages; Web must not fall back to the legacy pairing/session-only UI.
  if (communityAccountOrigin && !isRunningOnMac()) return <CommunityMobileHome />;
  // Until a computer is linked there is nothing for the home chrome to do:
  // the dock, filters, session list, and tablet sidebar all need a machine.
  // Native phones and tablets therefore share the same install step. Web
  // and desktop retain their existing account-linking flow.
  const showInstallStep = shouldShowFirstRunInstall({
    isAuthenticated: true,
    isDataReady,
    machineCount: machines.length,
    isWeb: Platform.OS === "web",
    isRunningOnMac: isRunningOnMac(),
  });
  if (showInstallStep) {
    return communityAccountOrigin ? <Redirect href="/devices/connect" /> : <OnboardingInstall />;
  }
  return <MainView variant="phone" />;
}

function NotAuthenticated() {
  if (communityAccountOrigin) return <CommunityWelcome />;
  const { theme } = useUnistyles();
  const auth = useAuth();
  const router = useRouter();
  const isLandscape = useIsLandscape();
  const insets = useSafeAreaInsets();
  const isMobile = Platform.OS === "android" || Platform.OS === "ios";

  const createAccount = async () => {
    try {
      const secret = await getRandomBytesAsync(32);
      const token = await authGetToken(secret);
      if (token && secret) {
        await auth.login(token, encodeBase64(secret, "base64url"));
        trackAccountCreated();
      }
    } catch (error) {
      Modal.alert(
        "社区服务未连接",
        "请先通过右上角配置独立的同步服务器。社区版不会连接商业版账号，也不会自动创建收费云端工作区。",
      );
    }
  };

  const openRestore = () => {
    trackAccountRestored();
    router.push("/restore");
  };

  // One filled action and one quiet text action underneath it. The restore
  // path is rare, so it reads as a footnote rather than a second button.
  const actions = isMobile ? (
    <>
      <View style={styles.buttonContainer}>
        <RoundButton title={t("onboarding.getStarted")} action={createAccount} />
      </View>
      <View style={styles.buttonContainerSecondary}>
        <RoundButton
          size="normal"
          title={t("onboarding.restoreExisting")}
          onPress={openRestore}
          display="inverted"
        />
      </View>
    </>
  ) : (
    <>
      <View style={styles.buttonContainer}>
        <RoundButton title={t("welcome.loginWithMobileApp")} onPress={openRestore} />
      </View>
      <View style={styles.buttonContainerSecondary}>
        <RoundButton
          size="normal"
          title={t("welcome.createAccount")}
          action={createAccount}
          display="inverted"
        />
      </View>
    </>
  );

  const logo = (
    <Text
      accessibilityLabel={appBrand}
      style={[
        styles.logo,
        { fontSize: 52, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
      ]}
    >
      {appBrand}
    </Text>
  );

  const portraitLayout = (
    <View style={styles.portraitContainer}>
      {logo}
      <Text style={styles.title}>{t("onboarding.headline")}</Text>
      <Text style={styles.subtitle}>{t("onboarding.tagline")}</Text>
      {communityAccountOrigin ? <CommunityLoginButtons /> : null}
      {communityAccountOrigin ? null : actions}
    </View>
  );

  const landscapeLayout = (
    <View style={[styles.landscapeContainer, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.landscapeInner}>
        <View style={styles.landscapeLogoSection}>{logo}</View>
        <View style={styles.landscapeContentSection}>
          <Text style={styles.landscapeTitle}>{t("onboarding.headline")}</Text>
          <Text style={styles.landscapeSubtitle}>{t("onboarding.tagline")}</Text>
          {communityAccountOrigin ? <CommunityLoginButtons /> : null}
          {communityAccountOrigin ? null : actions}
        </View>
      </View>
    </View>
  );

  return (
    <>
      <HomeHeaderNotAuth />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {isLandscape ? landscapeLayout : portraitLayout}
      </ScrollView>
    </>
  );
}

function CommunityWelcome() {
  const router = useRouter();
  return <BrandScreen footer={<Text style={brandStyles.caption}>KEEP IT SIMPLE &amp; STUPID</Text>}>
    {Platform.OS !== 'web' && <View style={{ alignItems: 'flex-end' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('server.title')} onPress={() => router.push('/server')}
        style={{ padding: 10 }}><Ionicons name="settings-outline" color={brand.secondary} size={22} /></Pressable>
    </View>}
    <View style={{ alignItems: 'center', gap: 26, marginBottom: 12 }}>
      <BrandLockup />
      <View style={{ gap: 8 }}><Text style={brandStyles.heading}>{copy('Your workspace. Anywhere.', '工作在手边。')}</Text>
        <Text style={brandStyles.body}>{copy('Sign in once. Pick up where you left off on your computer.', '登录同一个账号，接着电脑上的工作继续。')}</Text></View>
    </View>
    <CommunityLoginButtons />
  </BrandScreen>;
}

const styles = StyleSheet.create((theme) => ({
  // NotAuthenticated styles
  portraitContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 300,
    height: 90,
  },
  title: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 24,
    lineHeight: 30,
    ...Typography.default("semiBold"),
    color: theme.colors.text,
  },
  subtitle: {
    ...Typography.default(),
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginTop: 12,
    textAlign: "center",
    marginBottom: 48,
  },
  buttonContainer: {
    width: 280,
    maxWidth: "100%",
    marginBottom: 8,
  },
  buttonContainerSecondary: {
    width: 280,
    maxWidth: "100%",
  },
  // Landscape styles
  landscapeContainer: {
    flexBasis: 0,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  landscapeInner: {
    flexGrow: 1,
    flexBasis: 0,
    maxWidth: 800,
    flexDirection: "row",
  },
  landscapeLogoSection: {
    flexBasis: 0,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 24,
  },
  landscapeContentSection: {
    flexBasis: 0,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 24,
  },
  landscapeTitle: {
    textAlign: "center",
    fontSize: 24,
    lineHeight: 30,
    ...Typography.default("semiBold"),
    color: theme.colors.text,
  },
  landscapeSubtitle: {
    ...Typography.default(),
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginTop: 12,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 16,
  },
}));
