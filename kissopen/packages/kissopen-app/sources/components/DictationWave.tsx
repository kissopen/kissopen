import * as React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/** How many bars the wave shows; the newest level is the rightmost bar. */
export const DICTATION_WAVE_BARS = 40;

/**
 * The voice as it is heard: one bar per recent level reading, newest at the
 * right, so speech rolls across the composer while the recording runs. It
 * stands where the text field was, which is the reader's cue that what they
 * say is what will land there.
 */
export const DictationWave = React.memo(({ levels, color }: { levels: readonly number[]; color: string }) => {
    const shown = levels.slice(-DICTATION_WAVE_BARS);
    const padding = Math.max(0, DICTATION_WAVE_BARS - shown.length);
    return (
        <View accessibilityLabel="recording" style={styles.wave}>
            {Array.from({ length: padding }, (_, i) => (
                <View key={`pad-${i}`} style={[styles.bar, { height: 4, backgroundColor: color, opacity: 0.35 }]} />
            ))}
            {shown.map((level, i) => (
                <View
                    key={`bar-${padding + i}`}
                    style={[styles.bar, { height: 4 + Math.round(Math.min(1, Math.max(0, level)) * 24), backgroundColor: color }]}
                />
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 32, paddingHorizontal: 8 },
    bar: { width: 3, borderRadius: 2 },
});
