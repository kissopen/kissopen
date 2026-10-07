import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { KissopenWordmark } from "./KissopenShell";
import { TextField } from "./TextField";
import { partitionComponentProps } from "./componentProps";

export type PhoneLoginStep = "phone" | "code";
export type PhoneLoginProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    step: PhoneLoginStep;
    /** Digits only, without +86. */
    phone: string;
    /** Digits only. */
    code: string;
    /** Seconds before another code may be asked for; 0 when one may. */
    resendIn: number;
    busy?: boolean;
    error?: string;
    /** Shown instead of a sent message when a development server returns the code. */
    developmentCode?: string;
    /** False when the service cannot send codes; the form says so instead of failing. */
    available: boolean;
    /**
     * The service has not answered yet, so whether anyone is signed in is not
     * known: the page says it is connecting rather than asking for a login.
     */
    connecting?: boolean;
    /**
     * The page is the whole window — nothing else is usable until someone signs
     * in — so it carries its own drag lane where the title bar would be.
     */
    standalone?: boolean;
    onPhoneChange: (value: string) => void;
    onCodeChange: (value: string) => void;
    onCodeRequest: () => void;
    onSubmit: () => void;
    onPhoneEdit: () => void;
    /** The interface language, offered before signing in; omitted where it cannot be changed. */
    language?: {
        value: "system" | "zh" | "en";
        onChange: (value: "system" | "zh" | "en") => void;
    };
};

/** A mainland mobile number: 11 digits starting 13–19. */
const PHONE = /^1[3-9]\d{9}$/;

/** 13800138000 → 138 0013 8000, the grouping people read numbers in. */
function phoneGroups(phone: string): string {
    return [phone.slice(0, 3), phone.slice(3, 7), phone.slice(7)].filter(Boolean).join(" ");
}

/**
 * C-287 PhoneLogin — signing in with a phone number and the code sent to it.
 *
 * Two steps, one question each: which number, then which code. The second step
 * names the number the code went to and offers the way back to change it, so a
 * typo is corrected where it is noticed rather than by starting over. There is
 * no separate sign-up: the first code a number receives creates its account,
 * and the page says so, because "log in" alone reads as "for people who
 * already have one".
 */
export function PhoneLogin(props: PhoneLoginProps) {
    const [local] = partitionComponentProps(props, ["className", "data-testid", "style"]);
    const phoneValid = PHONE.test(props.phone);
    const request = () => {
        if (phoneValid && !props.busy && props.resendIn <= 0) props.onCodeRequest();
    };
    return (
        <section
            className={["kissopen-phone-login", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="phone-login"
            data-standalone={props.standalone ? "" : undefined}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {props.standalone && <div className="kissopen-phone-login__drag" />}
            <div className="kissopen-phone-login__card">
                <KissopenWordmark />
                {props.connecting ? (
                    <>
                        <p className="kissopen-phone-login__lead" role="status">
                            {t("正在连接KissOpen…")}
                        </p>
                        {props.error && (
                            <p className="kissopen-phone-login__error" role="alert">
                                {props.error}
                            </p>
                        )}
                    </>
                ) : props.step === "phone" ? (
                    <>
                        <h1 className="kissopen-phone-login__title">{t("登录或注册")}</h1>
                        <p className="kissopen-phone-login__lead">
                            {t("使用手机号继续。未注册的手机号验证后自动创建账号。")}
                        </p>
                        {props.available ? (
                            <>
                                <div className="kissopen-phone-login__phone">
                                    <span className="kissopen-phone-login__prefix">+86</span>
                                    <TextField
                                        aria-label={t("手机号")}
                                        autoComplete="tel-national"
                                        autoFocus
                                        disabled={props.busy}
                                        fullWidth
                                        onSubmit={request}
                                        onValueChange={props.onPhoneChange}
                                        placeholder={t("手机号")}
                                        size="large"
                                        value={props.phone}
                                    />
                                </div>
                                {props.error && (
                                    <p className="kissopen-phone-login__error" role="alert">
                                        {props.error}
                                    </p>
                                )}
                                <Button
                                    disabled={!phoneValid || props.resendIn > 0}
                                    fullWidth
                                    loading={props.busy}
                                    onClick={request}
                                    size="large"
                                    variant="primary"
                                >
                                    {props.resendIn > 0
                                        ? t("获取验证码（{seconds} 秒）", {
                                              seconds: props.resendIn,
                                          })
                                        : t("获取验证码")}
                                </Button>
                            </>
                        ) : (
                            <p className="kissopen-phone-login__error" role="status">
                                {t("短信登录暂未开放，请稍后再试。")}
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <h1 className="kissopen-phone-login__title">{t("输入验证码")}</h1>
                        <p className="kissopen-phone-login__lead">
                            {props.developmentCode
                                ? t("本地开发环境，验证码为 {code}", {
                                      code: props.developmentCode,
                                  })
                                : t("验证码已发送至 +86 {phone}", {
                                      phone: phoneGroups(props.phone),
                                  })}
                            <button
                                className="kissopen-phone-login__link"
                                disabled={props.busy}
                                onClick={props.onPhoneEdit}
                                type="button"
                            >
                                {t("更换手机号")}
                            </button>
                        </p>
                        <TextField
                            aria-label={t("短信验证码")}
                            autoComplete="one-time-code"
                            autoFocus
                            className="kissopen-phone-login__code"
                            disabled={props.busy}
                            fullWidth
                            onSubmit={() => {
                                if (props.code.length === 6) props.onSubmit();
                            }}
                            onValueChange={props.onCodeChange}
                            placeholder={t("6 位验证码")}
                            size="large"
                            value={props.code}
                        />
                        {props.error && (
                            <p className="kissopen-phone-login__error" role="alert">
                                {props.error}
                            </p>
                        )}
                        <Button
                            disabled={props.code.length !== 6}
                            fullWidth
                            loading={props.busy}
                            onClick={props.onSubmit}
                            size="large"
                            variant="primary"
                        >
                            {t("登录")}
                        </Button>
                        <button
                            className="kissopen-phone-login__link kissopen-phone-login__resend"
                            disabled={props.busy || props.resendIn > 0}
                            onClick={props.onCodeRequest}
                            type="button"
                        >
                            {props.resendIn > 0
                                ? t("{seconds} 秒后可重新获取", { seconds: props.resendIn })
                                : t("没收到？重新获取验证码")}
                        </button>
                    </>
                )}
            </div>
            {props.language && (
                <div className="kissopen-phone-login__language">
                    <SegmentedControl
                        aria-label={t("Language")}
                        onChange={(value) =>
                            props.language?.onChange(value as "system" | "zh" | "en")
                        }
                        // Each language is named in itself, so a reader who cannot
                        // read the current interface can still find their own.
                        segments={[
                            { value: "system", label: t("System") },
                            { value: "zh", label: "中文" },
                            { value: "en", label: "English" },
                        ]}
                        size="small"
                        value={props.language.value}
                    />
                </div>
            )}
        </section>
    );
}
