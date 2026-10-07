import * as React from "react";
import { View, Text, TextInput, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  CommunityAuthClient,
  communityAuthorizationWait,
  type CommunityProvider,
  type CommunityLoginHandle,
} from "@kissopen/kissopen-sync/communityAuth";
import { consumerSessionStarted } from "@/kissopen/sessionEvents";
import { useAuth } from "@/auth/AuthContext";
import { getServerUrl } from "@/sync/serverConfig";
import { Modal } from "@/modal";
import { BrandButton, brand, brandStyles, onboardingText as copy } from './BrandScreen';

export function CommunityLoginButtons() {
  const auth = useAuth();
  const router = useRouter();
  const origin = getServerUrl();
  const client = React.useMemo(() => new CommunityAuthClient(origin), [origin]);
  const [providers, setProviders] = React.useState<readonly CommunityProvider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<CommunityProvider | "password" | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [providerError, setProviderError] = React.useState<string>();
  const [showPassword, setShowPassword] = React.useState(false);
  const controller = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    const active = new AbortController();
    void (async () => {
      while (!active.signal.aborted) {
        try {
          const available = await client.providers(active.signal);
          if (!active.signal.aborted) {
            setProviders(available);
            setProviderError(undefined);
            setLoading(false);
          }
        } catch (error) {
          if (!active.signal.aborted) {
            setProviderError(copy('Cannot load social sign-in right now. Password sign-in is still available; we will retry automatically.', '暂时无法获取第三方登录方式。仍可使用用户名密码登录，稍后会自动重试。'));
            setLoading(false);
          }
        }
        await communityAuthorizationWait(10000, active.signal).catch(() => undefined);
      }
    })();
    return () => {
      active.abort();
      const flow = controller.current;
      controller.current = null;
      flow?.abort();
    };
  }, [client]);

  const signIn = async (provider?: CommunityProvider) => {
    if (controller.current) return;
    // Open synchronously in the user gesture, before the network request,
    // so browsers do not block the provider window as an unsolicited popup.
    const popup = provider && Platform.OS === "web" ? window.open("about:blank", "_blank") : null;
    if (provider && Platform.OS === "web" && !popup) {
      setError("Allow pop-ups for KissOpen, then try again.");
      return;
    }
    if (popup) popup.opener = null;
    const active = (controller.current = new AbortController());
    setBusy(provider ?? "password");
    setError(undefined);
    let login: CommunityLoginHandle | undefined;
    let issuedSession: string | undefined;
    let completed = false;
    let nativeBrowserOpened = false;
    try {
      if (provider) {
      const authorization = await client.start(provider, active.signal);
      login = authorization;
      if (active.signal.aborted) return;
      if (popup) popup.location.href = authorization.authorizationUrl;
      else {
        nativeBrowserOpened = true;
        void WebBrowser.openBrowserAsync(authorization.authorizationUrl).catch(() => {
          if (!active.signal.aborted) {
            active.abort();
            setError("Could not open your browser. Please try again.");
          }
        });
      }
      } else {
        const enteredPassword = password;
        setPassword("");
        login = await client.password(username.trim().toLowerCase(), enteredPassword, active.signal);
      }
      while (!active.signal.aborted && Date.now() < Date.parse(login.expiresAt)) {
        const status = await client.status(login, active.signal);
        if (status.status === "failed") throw new Error(status.message);
        if (status.status === "second_factor") {
          if (nativeBrowserOpened && Platform.OS === "ios") { WebBrowser.dismissBrowser(); nativeBrowserOpened = false; }
          const code = await Modal.prompt(copy("Two-factor authentication", "双重验证"), copy("Enter an authenticator code or an unused recovery code.", "输入验证器动态码或未使用的恢复码。"), { inputType: "secure-text", confirmText: copy("Verify", "验证"), cancelText: copy("Cancel", "取消") });
          if (active.signal.aborted || code === null) return;
          try { await client.factor(login, code, active.signal); }
          catch (error) { if (active.signal.aborted) return; await Modal.alert("Code not accepted", error instanceof Error ? error.message : "Please try again."); }
          continue;
        }
        if (status.status === "authorized") {
          if (nativeBrowserOpened && Platform.OS === "ios") {
            WebBrowser.dismissBrowser();
            nativeBrowserOpened = false;
          }
          const result = await client.complete(login, undefined, active.signal);
          completed = true;
          issuedSession = result.token;
          if (active.signal.aborted) { void client.signOut(result.token).catch(() => undefined); return; }
          await auth.accountLogin(result.token, result.profile);
          issuedSession = undefined;
          consumerSessionStarted();
          router.replace('/devices/connect');
          return;
        }
        await communityAuthorizationWait(2000, active.signal);
      }
      if (!active.signal.aborted) throw new Error("Authorization expired. Please sign in again.");
    } catch (error) {
      if (!active.signal.aborted)
        setError(error instanceof Error ? error.message : "Sign-in could not be completed.");
    } finally {
      popup?.close();
      if (nativeBrowserOpened && Platform.OS === "ios") WebBrowser.dismissBrowser();
      if (login && !completed) void client.cancel(login).catch(() => undefined);
      if (issuedSession) void client.signOut(issuedSession).catch(() => undefined);
      if (controller.current === active) {
        controller.current = null;
        setBusy(null);
      }
    }
  };
  return (
    <View style={{ width: '100%', gap: 14 }}>
      <View><Text style={brandStyles.label}>{copy('Username', '用户名')}</Text>
        <TextInput accessibilityLabel={copy('Username', '用户名')} placeholder={copy('Your username', '输入用户名')}
          placeholderTextColor={brand.muted} autoCorrect={false} autoCapitalize="none" autoComplete="username"
          value={username} onChangeText={setUsername} editable={!busy} style={brandStyles.input} /></View>
      <View><Text style={brandStyles.label}>{copy('Password', '密码')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput accessibilityLabel={copy('Password', '密码')} placeholder={copy('Your password', '输入密码')}
            placeholderTextColor={brand.muted} autoCapitalize="none" autoComplete="current-password" secureTextEntry={!showPassword}
            value={password} onChangeText={setPassword} editable={!busy} style={[brandStyles.input, { flex: 1, paddingRight: 66 }]}
            returnKeyType="go" onSubmitEditing={() => { if (username.trim() && password && !busy) void signIn(); }} />
          <Pressable accessibilityRole="button" accessibilityLabel={copy('Show or hide password', '显示或隐藏密码')}
            onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, paddingVertical: 12 }}>
            <Text style={{ color: brand.secondary, fontSize: 12 }}>{showPassword ? copy('Hide', '隐藏') : copy('Show', '显示')}</Text>
          </Pressable>
        </View>
      </View>
      <BrandButton title={copy('Sign in', '登录')} busy={busy === 'password'} disabled={!!busy || !username.trim() || !password} onPress={() => void signIn()} />
      {providers.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
        <View style={{ height: 1, flex: 1, backgroundColor: brand.line }} /><Text style={brandStyles.caption}>{copy('OR', '或')}</Text><View style={{ height: 1, flex: 1, backgroundColor: brand.line }} />
      </View> : null}
      {providers.map((provider) => (
        <BrandButton quiet
          key={provider}
          title={`${copy('Continue with', '使用')} ${{ github: "GitHub", google: "Google", nodeloc: "NodeLoc" }[provider]}${copy('', ' 登录')}`}
          busy={busy === provider} disabled={!!busy}
          onPress={() => void signIn(provider)}
        />
      ))}
      {loading ? (
        <Text style={brandStyles.body}>{copy('Checking sign-in options…', '正在获取登录方式…')}</Text>
      ) : !providers.length ? (
        <Text style={brandStyles.body}>
          {copy('Social sign-in is not configured on this server.', '此服务器尚未配置第三方登录。')}
        </Text>
      ) : null}
      {busy ? (
        <>
          <Text style={brandStyles.body}>{busy === 'password' ? copy('Signing you in…', '正在登录…') : copy('Complete authorization in your browser, then return here.', '请在浏览器完成授权，然后返回这里。')}</Text>
          <BrandButton quiet
            title={copy('Cancel sign-in', '取消登录')}
            onPress={() => {
              controller.current?.abort();
              setBusy(null);
            }}
          />
        </>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={brandStyles.error}>
          {error}
        </Text>
      ) : null}
      {!error && providerError ? <Text style={brandStyles.error}>{providerError}</Text> : null}
      <Text style={[brandStyles.body, { fontSize: 12, marginTop: 4 }]}>
        {copy('New here? Use a sign-in provider to create an account. You can set a password in your profile later.', '首次使用？通过第三方登录创建账号，之后可在个人资料设置密码。')}
      </Text>
    </View>
  );
}
