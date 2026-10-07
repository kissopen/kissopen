import * as React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useUnistyles } from 'react-native-unistyles';
/** Canonical outlined wordmark, identical in every language. */
export const KissopenLockup = React.memo(function KissopenLockup(props: {
    height?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}) {
    const { theme } = useUnistyles();
    const height = props.height ?? 26;
    const source = props.color
        ? require('../assets/images/kissopen-lockup-mono.png')
        : theme.dark ? require('../assets/images/kissopen-lockup-dark.png') : require('../assets/images/kissopen-lockup-light.png');
    return (
        <View accessible accessibilityRole="header" accessibilityLabel="KissOpen" style={props.style}>
            <Image source={source} tintColor={props.color} contentFit="contain"
                style={{ height, aspectRatio: 768 / 91 }} />
        </View>
    );
});
