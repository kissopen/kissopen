import { appMarket } from '@/appIdentity';
import { consumerSessionEnded, consumerSessionStarted, personaSaved } from '../sessionEvents';
import { kissopenBrandText } from '../brandText';
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { APIError } from "./protocol";
import { t } from '@/text';
import {
  clearSession,
  nativeSession,
  request,
  saveSession,
  serverOrigin,
} from "../platform/transport";
import { cloudCache, cloudCacheClear } from "../cloudCache";
import { themeApply } from "../useTheme";
import type {
  AvatarUpload,
  AppleCatalog,
  AppleSyncRequest,
  AppleSyncResult,
  Billing,
  ChatRequest,
  CodeRequest,
  CodeSent,
  Config,
  Conversation,
  ConversationDetail,
  ConversationUpdate,
  EventPage,
  FileItem,
  DocumentUpload,
  FileUpload,
  ImageUpload,
  Job,
  LoginRequest,
  LoginResult,
  CloudProjectCreate,
  CloudProjectCreated,
  HomeDemoRequest,
  HomeDemoStatus,
  Model,
  Ok,
  Persona,
  PersonaUpdate,
  Profile,
  ProfileUpdate,
  ProfileUser,
  ReasoningEffort,
  SignupSource,
  Theme,
  ThemeGallery,
  ThemeGenerated,
  ThemeGenerateRequest,
  ThemeImage,
  ThemeImageUpload,
  ThemeSelect,
  ThemeSelected,
  ThemesPage,
  ThemeWrite,
  Transcription,
  TranscriptionRequest,
  UploadedImage,
  User,
} from "./types";
export const requestID = () => Crypto.randomUUID();
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await request(path, method, body);
  let data: any;
  try {
    data = JSON.parse(response.text);
  } catch {
    throw new APIError(response.status, t('kissopen.errors.serverError'));
  }
  if (response.status < 200 || response.status >= 300)
    throw new APIError(response.status, data.error || t('kissopen.errors.requestFailed'));
  return data;
}
const item = encodeURIComponent;
/** How far an invited person has come; see `internal/app/invite.go`. */
export type InviteeStatus = "bound" | "review" | "rewarded" | "capped" | "rejected" | "revoked";
export type Invitee = { name: string; status: InviteeStatus; at: number };
/** The account's invite page: its code and link, the rules, what it earned and whom it invited. */
export type InviteInfo = {
  enabled: boolean;
  code: string;
  link: string;
  inviter_points: number;
  invitee_points: number;
  /** How many invited people are rewarded at most; 0 = no limit. */
  max_rewarded: number;
  daily_max: number;
  /** Days after signing up an account may still type an invite code. */
  bind_days: number;
  invited: number;
  rewarded: number;
  earned_points: number;
  /** Points still to be earned; -1 = no limit. */
  remaining_points: number;
  invitees: Invitee[];
  /** Whether this account may still type someone's code. */
  can_bind: boolean;
  /** The code this account was invited with, when there is one. */
  bound_code: string;
  /** Until when (ms) a code may still be typed. */
  bind_before: number;
};

const SIGNUP_SOURCE_KEY = "kissopen.signup-source";
const SIGNUP_SOURCE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
type SignupFields = Omit<SignupSource, "client">;
const signupField = (value: unknown, limit = 200) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : undefined;
/** Keeps only the fields that say something, so an empty record adds nothing. */
function signupFields(value: Record<string, unknown>): SignupFields {
  const out: SignupFields = {
    ref: signupField(value.ref, 64),
    utm_source: signupField(value.utm_source),
    utm_medium: signupField(value.utm_medium),
    utm_campaign: signupField(value.utm_campaign),
    landing: signupField(value.landing, 500),
    referrer: signupField(value.referrer, 500),
  };
  for (const key of Object.keys(out) as (keyof SignupFields)[]) if (out[key] === undefined) delete out[key];
  return out;
}
/**
 * Where a new account came from, sent with every sign-in (the server keeps it
 * only when the sign-in creates the account). On the phone web version this is
 * the first visit the product site recorded (under 30 days old) and, over it,
 * an invite or campaign in the address this page was opened with.
 */
function signupSource(): SignupSource {
  if (Platform.OS !== "web") return { client: Platform.OS === "ios" ? "ios" : "android" };
  let stored: SignupFields = {};
  try {
    const raw = globalThis.localStorage?.getItem(SIGNUP_SOURCE_KEY);
    const record = raw ? JSON.parse(raw) : undefined;
    if (record && typeof record === "object" && typeof record.at === "number" && Date.now() - record.at <= SIGNUP_SOURCE_MAX_AGE)
      stored = signupFields(record);
  } catch {}
  let opened: SignupFields = {};
  try {
    const location = globalThis.location;
    if (location) {
      const query = new URLSearchParams(location.search);
      opened = signupFields({
        ref: query.get("ref"),
        utm_source: query.get("utm_source"),
        utm_medium: query.get("utm_medium"),
        utm_campaign: query.get("utm_campaign"),
      });
      if (Object.keys(opened).length) opened = { ...opened, landing: signupField(location.pathname + location.search, 500), referrer: signupField(globalThis.document?.referrer, 500) };
    }
  } catch {}
  return { ...stored, ...opened, client: "mobile_web" };
}

export type Announcement = { id: string; title: string; body: string; level: "info" | "warning" };

/*
 * The answers the home opens on — the account, its models and conversations —
 * are kept on the phone as they arrive (cloudCache), so the next start and a
 * phone without a connection show them at once. Signing out forgets them.
 */
function kept<T>(save: (value: T) => void) {
  return (value: T) => { save(value); return value; };
}

export const client = {
  config: () => api<Config>("/config"),
  me: () => api<User>("/me").then(kept(user => { cloudCache.accountConfirmed(serverOrigin, user); themeApply(user.theme); })),
  /** Makes a project in the account's cloud workspace and starts its first conversation with the goal. */
  cloudProjectCreate: (name: string, goal: string) =>
    api<CloudProjectCreated>("/cloud/projects", "POST", { name, goal } satisfies CloudProjectCreate),
  /** The home page's demonstration: ready, or still being written (ask again). */
  homeDemo: (refresh = false) =>
    api<HomeDemoStatus>("/home/demo", "POST", { refresh } satisfies HomeDemoRequest),
  /**
   * Keeps what the person said about their work (or that they skipped
   * saying), on the account kept on this phone too, so the gate opens and
   * the home asks for its page without another `/me`.
   */
  persona: (update: PersonaUpdate) =>
    api<Persona>("/persona", "POST", update).then(kept(persona => {
      const user = cloudCache.user();
      if (user) cloudCache.accountConfirmed(serverOrigin, { ...user, persona });
      personaSaved(persona);
    })),
  models: async () => kept<Model[]>(models => cloudCache.modelsWrite(models))((await api<Model[]>("/models")).map((model) => ({
    ...model,
    name: kissopenBrandText(model.name),
    description: kissopenBrandText(model.description),
  }))),
  code: (phone: string) =>
    api<CodeSent>("/auth/code", "POST", { phone } satisfies CodeRequest),
  async login(phone: string, code: string) {
    const data = await api<LoginResult>("/auth/login", "POST", {
      phone,
      code,
      client: nativeSession ? "app" : "web",
      source: signupSource(),
    } satisfies LoginRequest);
    if (data.access_token) await saveSession(data.access_token);
    consumerSessionStarted();
  },
  async logout() {
    await api("/auth/logout", "POST", {});
    cloudCacheClear();
    await clearSession();
    await consumerSessionEnded();
  },
  async forgetSession() {
    cloudCacheClear();
    await clearSession();
    await consumerSessionEnded();
  },
  conversations: () => api<Conversation[]>("/conversations").then(kept(list => cloudCache.conversationsWrite(list))),
  conversation: (id: string) => api<ConversationDetail>("/conversations/" + item(id)).then(kept(detail => cloudCache.conversationWrite(detail))),
  conversationUpdate: (id: string, update: ConversationUpdate) =>
    api<Conversation>("/conversations/" + item(id), "POST", update),
  conversationDelete: (id: string) => api<Ok>(`/conversations/${item(id)}/delete`, "POST", {}).then(kept(() => cloudCache.conversationForget(id))),
  chat: (
    request_id: string,
    text: string,
    model: string,
    file_ids: string[],
    conversation_id = "",
    temporary = false,
    image_ids: string[] = [],
    reasoning_effort: ReasoningEffort = "auto",
  ) =>
    api<Job>("/chat", "POST", {
      request_id,
      text,
      model,
      file_ids,
      conversation_id,
      image_ids,
      reasoning_effort,
      ...(temporary ? { temporary: true } : {}),
    } satisfies ChatRequest),
  events: (id: string, after: number) =>
    api<EventPage>(`/jobs/${item(id)}/poll?after=${after}`),
  cancel: (id: string) => api(`/jobs/${item(id)}/cancel`, "POST", {}),
  files: () => api<FileItem[]>("/files"),
  upload: (name: string, content: string) =>
    api<FileItem>("/files", "POST", { name, content } satisfies FileUpload),
  uploadDocument: (name: string, data: string) =>
    api<FileItem>("/files/document", "POST", { name, data } satisfies DocumentUpload),
  uploadImage: (name: string, mime: string, data: string, width: number, height: number) =>
    api<UploadedImage>("/images", "POST", { name, mime, data, width, height } satisfies ImageUpload),
  transcribe: (mime: string, data: string, duration_ms: number) =>
    api<Transcription>("/transcriptions", "POST", { mime, data, duration_ms } satisfies TranscriptionRequest),
  billing: () => api<Billing>("/billing"),
  appleCatalog: () => api<AppleCatalog>(`/billing/apple/catalog?market=${appMarket}`),
  appleSync: (body: AppleSyncRequest = {}) => api<AppleSyncResult>("/billing/apple/sync", "POST", { ...body, market: appMarket }),
  /** Starts buying a plan; `url` is the payment platform's page to open. */
  checkout: (item: { plan: string } | { pack: string }) => api<{ order: string; url: string }>("/billing/checkout", "POST", item),
  /** What the operator wants everyone to know now; an older server has none. */
  announcements: () => api<{ announcements: Announcement[] }>("/announcements").then(out => out.announcements ?? []),
  order: (id: string) => api<{ id: string; status: string }>(`/billing/orders/${encodeURIComponent(id)}`),
  profile: () => api<Profile>("/profile"),
  profileUpdate: (update: ProfileUpdate) =>
    api<ProfileUser>("/profile", "POST", update satisfies ProfileUpdate),
  avatarUpload: (mime: string, data: string) =>
    api<ProfileUser>("/profile/avatar", "POST", { mime, data } satisfies AvatarUpload),
  /** The account's invite code, link, rules and the people it invited. */
  invite: () => api<InviteInfo>("/invite"),
  /** The theme settings page: what is chosen, the built-in ones, mine, the featured. */
  themes: () => api<ThemesPage>("/themes"),
  /** A page of the themes people published; `sort` is "uses" (default) or "new". */
  themesGallery: (q = "", sort: "uses" | "new" = "uses", limit = 24, offset = 0) =>
    api<ThemeGallery>(`/themes/gallery?q=${item(q)}&sort=${sort}&limit=${limit}&offset=${offset}`),
  /** One theme: a system or published one, or one of mine. */
  theme: (id: string) => api<Theme>("/themes/" + item(id)),
  themeCreate: (write: ThemeWrite) => api<Theme>("/themes", "POST", write),
  themeUpdate: (id: string, write: ThemeWrite) => api<Theme>("/themes/" + item(id), "PUT", write),
  themeDelete: (id: string) => api<Ok>("/themes/" + item(id), "DELETE"),
  themePublish: (id: string, publish: boolean) => api<Theme>(`/themes/${item(id)}/${publish ? "publish" : "unpublish"}`, "POST", {}),
  /**
   * Chooses a theme for the account (an empty id is the app's own look) and
   * paints it at once, on the account kept on this phone too.
   */
  themeSelect: (id: string) =>
    api<ThemeSelected>("/themes/select", "POST", { id } satisfies ThemeSelect).then(kept(out => {
      const user = cloudCache.user();
      if (user) cloudCache.accountConfirmed(serverOrigin, { ...user, theme: out.theme ?? null });
      themeApply(out.theme ?? null);
    })),
  /** Asks a model for a theme (not saved), or for a change to `base`. */
  themeGenerate: (prompt: string, base?: ThemeGenerated["doc"]) =>
    api<ThemeGenerated>("/themes/generate", "POST", { prompt, ...(base ? { base } : {}) } satisfies ThemeGenerateRequest),
  /** A background picture for a theme; the answer's url is what a theme may point at. */
  themeImageUpload: (mime: string, data: string) =>
    api<ThemeImage>("/themes/images", "POST", { mime, data } satisfies ThemeImageUpload),
};
