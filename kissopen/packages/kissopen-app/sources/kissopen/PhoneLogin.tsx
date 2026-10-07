import * as React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import type { CodeSent } from './api/types';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';

/** A mainland mobile number: 11 digits starting 13–19. */
const PHONE = /^1[3-9]\d{9}$/;

function phoneGroups(phone: string): string {
    return [phone.slice(0, 3), phone.slice(3, 7), phone.slice(7)].filter(Boolean).join(' ');
}

/**
 * Signing in with a phone number and the code sent to it — the same two steps
 * as the desktop: which number, then which code. The second step names the
 * number and offers the way back to change it, and the sixth digit signs in.
 * The first code a number receives creates its account, and the page says so.
 */
export function PhoneLogin(props: {
    available: boolean;
    onCodeRequest: (phone: string) => Promise<CodeSent>;
    onLogin: (phone: string, code: string) => Promise<void>;
}) {
    const { theme } = useUnistyles();
    const [step, setStep] = React.useState<'phone' | 'code'>('phone');
    const [phone, setPhone] = React.useState('');
    const [code, setCode] = React.useState('');
    const [developmentCode, setDevelopmentCode] = React.useState('');
    const [resendIn, setResendIn] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    React.useEffect(() => {
        if (resendIn <= 0) return;
        const timer = setTimeout(() => setResendIn(value => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendIn]);

    const attempt = async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await action(); } catch (e) { setError(e instanceof Error ? e.message : t('kissopen.errors.requestFailed')); } finally { setBusy(false); }
    };
    const request = () => void attempt(async () => {
        if (!PHONE.test(phone) || resendIn > 0) return;
        const result = await props.onCodeRequest(phone);
        setStep('code'); setCode(''); setDevelopmentCode(result.development_code ?? '');
        setResendIn(result.retry_after || 60);
    });
    const login = (value: string) => void attempt(async () => {
        try { await props.onLogin(phone, value); } catch (e) { setCode(''); throw e; }
    });
    const codeChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 6);
        setCode(digits); setError('');
        if (digits.length === 6) login(digits);
    };

    if (!props.available) return <Text style={styles.lead}>{t('kissopen.login.smsUnavailable')}</Text>;
    return step === 'phone' ? <>
        <Text style={styles.title}>{t('kissopen.login.title')}</Text>
        <Text style={styles.lead}>{t('kissopen.login.subtitle')}</Text>
        <View style={styles.phoneRow}>
            <Text style={styles.prefix}>+86</Text>
            <TextInput style={[styles.field, { flex: 1 }]} value={phone} onChangeText={value => { setPhone(value.replace(/\D/g, '').slice(0, 11)); setError(''); }}
                placeholder={t('kissopen.login.phone')} placeholderTextColor={theme.colors.textSecondary} accessibilityLabel={t('kissopen.login.phone')}
                keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={11} autoFocus editable={!busy} onSubmitEditing={request} />
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <RoundButton title={resendIn > 0 ? t('kissopen.login.sendCodeCountdown', { seconds: resendIn }) : t('kissopen.login.sendCode')} disabled={busy || !PHONE.test(phone) || resendIn > 0} onPress={request} />
    </> : <>
        <Text style={styles.title}>{t('kissopen.login.codeTitle')}</Text>
        <Text style={styles.lead}>{developmentCode ? t('kissopen.login.developmentCode', { code: developmentCode }) : t('kissopen.login.codeSent', { phone: phoneGroups(phone) })}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setStep('phone'); setCode(''); setError(''); }} style={styles.linkButton}>
            <Text style={styles.link}>{t('kissopen.login.changePhone')}</Text>
        </Pressable>
        <TextInput style={[styles.field, styles.code]} value={code} onChangeText={codeChange}
            placeholder={t('kissopen.login.codePlaceholder')} placeholderTextColor={theme.colors.textSecondary} accessibilityLabel={t('kissopen.login.codeLabel')}
            keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} autoFocus editable={!busy} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {busy ? <KissopenLoader size={22} /> : <RoundButton title={t('kissopen.login.submit')} disabled={code.length !== 6} onPress={() => login(code)} />}
        <Pressable accessibilityRole="button" disabled={busy || resendIn > 0} onPress={request} style={styles.linkButton}>
            <Text style={[styles.link, resendIn > 0 && styles.muted]}>{resendIn > 0 ? t('kissopen.login.resendCountdown', { seconds: resendIn }) : t('kissopen.login.resend')}</Text>
        </Pressable>
    </>;
}

const styles = StyleSheet.create(theme => ({
    title: { fontSize: 25, color: theme.colors.text, ...Typography.default('semiBold') },
    lead: { fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    prefix: { fontSize: 16, color: theme.colors.textSecondary, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.colors.input.background },
    field: { color: theme.colors.text, backgroundColor: theme.colors.input.background, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 48 },
    code: { fontSize: 22, letterSpacing: 8, textAlign: 'center', marginTop: 8 },
    error: { color: theme.colors.textDestructive, fontSize: 14, lineHeight: 20 },
    linkButton: { alignSelf: 'flex-start', paddingVertical: 4 },
    link: { color: theme.colors.text, fontSize: 14, textDecorationLine: 'underline', ...Typography.default('semiBold') },
    muted: { color: theme.colors.textSecondary, textDecorationLine: 'none' },
}));
