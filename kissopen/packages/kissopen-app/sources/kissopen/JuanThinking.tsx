import * as React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { KissopenLoader } from './KissopenLoader';
import { MARK_ASPECT } from './juanMark';
/** Kept export name for existing callers; artwork is the KissOpen relay. */
export const JuanThinking = React.memo(function JuanThinking(props: {
    label?: string; width?: number; style?: StyleProp<ViewStyle>;
}) {
    const { theme } = useUnistyles();
    return (
        <View accessibilityRole="progressbar" accessibilityLabel={props.label}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, props.style]}>
            <KissopenLoader size={(props.width ?? 52) / MARK_ASPECT} variant="relay" />
            {!!props.label && <Text style={{ ...Typography.default('semiBold'), fontSize: 13, lineHeight: 20,
                color: theme.colors.text }}>{props.label}</Text>}
        </View>
    );
});
