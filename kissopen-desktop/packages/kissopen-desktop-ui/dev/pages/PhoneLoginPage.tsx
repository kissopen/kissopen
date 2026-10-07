import { PhoneLogin, type PhoneLoginProps } from "../../src/PhoneLogin";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-287";

const noop = () => {};
const stage: Record<string, string> = { display: "flex", width: "720px", height: "560px" };
const base: PhoneLoginProps = {
    available: true,
    code: "",
    onCodeChange: noop,
    onCodeRequest: noop,
    onPhoneChange: noop,
    onPhoneEdit: noop,
    onSubmit: noop,
    phone: "",
    resendIn: 0,
    step: "phone",
};

export function PhoneLoginPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Signing in with a phone number and the code sent to it. Two steps, one question each; the first code a number receives creates its account."
            title="PhoneLogin"
        >
            <Specimen
                detail="empty number · the button waits for 11 digits"
                label="Number"
                number="01"
                stage="app"
            >
                <div style={stage}>
                    <PhoneLogin {...base} />
                </div>
            </Specimen>
            <Specimen
                detail="a valid number · ready to send"
                label="Number filled"
                number="02"
                stage="app"
            >
                <div style={stage}>
                    <PhoneLogin {...base} phone="13800138000" />
                </div>
            </Specimen>
            <Specimen
                detail="code sent · resend counts down · the number stays editable"
                label="Code"
                number="03"
                stage="app"
            >
                <div style={stage}>
                    <PhoneLogin
                        {...base}
                        code="4821"
                        phone="13800138000"
                        resendIn={42}
                        step="code"
                    />
                </div>
            </Specimen>
            <Specimen
                detail="a refused code clears the field and says why"
                label="Code refused"
                number="04"
                stage="app"
            >
                <div style={stage}>
                    <PhoneLogin
                        {...base}
                        error="验证码错误、已失效或尝试次数过多"
                        phone="13800138000"
                        step="code"
                    />
                </div>
            </Specimen>
            <Specimen
                detail="the service cannot send codes"
                label="Unavailable"
                number="05"
                stage="app"
            >
                <div style={stage}>
                    <PhoneLogin {...base} available={false} />
                </div>
                <DimensionRule label="column 360px · title 24/32 · controls 44px · 16px between rows" />
            </Specimen>
            <Specimen
                detail="the service has not answered yet · no login is asked for"
                label="Connecting"
                number="06"
                stage="app"
            >
                <div style={stage}>
                    <PhoneLogin {...base} connecting error="正在重新连接 KISSOPEN" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
