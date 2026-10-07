import * as React from 'react';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { JUAN, MARK_ASPECT, MARK_VIEWBOX, MARK_LEFT, MARK_RIGHT } from './juanMark';
export const KISSOPEN_GLYPH_ASPECT = MARK_ASPECT;
export const KissopenGlyph = React.memo(function KissopenGlyph(props: {
    size?: number;
    color?: string;
    /** Legacy compatibility; both wedges always have the same brand colour. */
    backColor?: string;
    /** KissOpen VI does not use glow. */
    glow?: boolean;
}) {
    const size = props.size ?? 32;
    const color = props.color ?? JUAN.accent;
    return (
        <Svg width={size * MARK_ASPECT} height={size} viewBox={MARK_VIEWBOX}
            accessibilityRole="image" accessibilityLabel="KissOpen">
            <Path d={MARK_LEFT} fill={color} stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={MARK_RIGHT} fill={color} stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
});
export const KissopenIcon = React.memo(function KissopenIcon(props: { size?: number }) {
    const size = props.size ?? 32;
    return <Image source={require('../assets/images/kissopen-app-tile.png')}
        style={{ width: size, height: size }} contentFit="contain"
        accessibilityLabel="KissOpen" />;
});
