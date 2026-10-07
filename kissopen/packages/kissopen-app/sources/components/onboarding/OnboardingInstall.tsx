import * as React from 'react';
import { Linking, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { RoundButton } from '../RoundButton';
import { t } from '@/text';

const DESKTOP_URL = 'https://kissopen.com/#start';

/**
 * Step 2 of the first run: get Kissopen onto the computer. Shown at the home
 * route once the account exists and no machine has been linked yet, in place
 * of the session list and its dock.
 */
export const OnboardingInstall = React.memo(function OnboardingInstall() {
    return (
        <View style={styles.root}>
            <View style={styles.content}>
                <Text style={styles.title}>{t('onboarding.installTitle')}</Text>
                <Text style={styles.body}>
                    {t('onboarding.installBodyPrefix')}
                    <Text
                        style={styles.bodyLink}
                        accessibilityRole="link"
                        onPress={() => { void Linking.openURL(DESKTOP_URL); }}
                    >
                        {t('onboarding.installBodyLink')}
                    </Text>
                    {t('onboarding.installBodySuffix')}
                </Text>
                <View style={styles.buttonContainer}>
                    <RoundButton
                        title={t('onboarding.installBodyLink')}
                        onPress={() => { void Linking.openURL(DESKTOP_URL); }}
                    />
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.groupped.background,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 48,
    },
    title: {
        ...Typography.default('semiBold'),
        fontSize: 24,
        lineHeight: 30,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    body: {
        ...Typography.default(),
        fontSize: 17,
        lineHeight: 22,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 40,
    },
    bodyLink: {
        color: theme.colors.text,
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        width: 280,
        maxWidth: '100%',
        marginBottom: 8,
    },
}));
