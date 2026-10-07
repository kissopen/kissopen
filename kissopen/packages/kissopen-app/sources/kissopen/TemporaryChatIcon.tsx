import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * The dashed bubble for temporary chat. `active` adds a tick inside it, so the
 * mode reads as on from the glyph itself rather than only from the glass tint
 * behind the button.
 */
export function TemporaryChatIcon({ color, size = 24, active = false }: { color: string; size?: number; active?: boolean }) {
    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5.3 4.7a9 9 0 0 1 12.5-.8M20 7.8a9 9 0 0 1-1.1 10M15.5 20.3a9 9 0 0 1-6.8 0L4 21l.7-4.7A9 9 0 0 1 3 11.2M3.3 8a9 9 0 0 1 .4-1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Tucked inside the r=9 ring, so it clears the dashes on every side. */}
        {active && <Path d="M8.4 12.2 11 14.8 15.7 9.7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>;
}
