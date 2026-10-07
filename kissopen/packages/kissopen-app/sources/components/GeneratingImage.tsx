import * as React from 'react';
import { Text, View } from 'react-native';
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';

/**
 * How far along a picture is, from how long it has been coming.
 *
 * Generation reports nothing while it runs, so the number is an estimate: it
 * climbs quickly at first and slows as it nears the top, the way a wait feels,
 * and never reaches the end on its own — only the finished picture does that.
 * The curve is tuned to the half minute a picture usually takes.
 */
export function imageGenerationProgress(elapsedMs: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
    return 0.96 * (1 - Math.exp(-elapsedMs / 22_000));
}

/** Dots across the shorter side. */
const COLUMNS = 40;
const FRAME_MS = 1000 / 24;

/**
 * A picture being generated, drawn as the picture's own idea of itself: a
 * halftone grid whose dots swell where the image will be dense and fade toward
 * the edges, drifting while nothing has arrived yet. As the estimate climbs,
 * more of the grid fills in, and the badge in the corner says how far.
 *
 * All the dots are one Skia path rebuilt a couple of dozen times a second,
 * which is cheap; a thousand separate views would not be.
 */
export const GeneratingImage = React.memo((props: {
    /** How far along, 0–1. Drawn as how much of the grid has filled in. */
    progress: number;
    /** The badge in the corner, such as "76%". Absent draws no badge. */
    label?: string;
    width: number;
    height: number;
}) => {
    const { theme } = useUnistyles();
    const [time, setTime] = React.useState(0);
    React.useEffect(() => {
        const started = Date.now();
        const timer = setInterval(() => setTime((Date.now() - started) / 1000), FRAME_MS);
        return () => clearInterval(timer);
    }, []);
    const path = React.useMemo(
        () => fieldPath(props.width, props.height, props.progress, time),
        [props.width, props.height, props.progress, time],
    );
    return (
        <View style={[styles.frame, { width: props.width, height: props.height }]}>
            <Canvas style={{ width: props.width, height: props.height }}>
                {/* Light on purpose: a placeholder, not a dark mass. */}
                <Path path={path} color={theme.colors.textSecondary} opacity={0.45} />
            </Canvas>
            {!!props.label && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{props.label}</Text>
                </View>
            )}
        </View>
    );
});

/**
 * One frame of the field, as a path.
 *
 * Three soft blobs drift across the grid on slow, unequal orbits, so the dense
 * region wanders rather than pulses; progress lifts the whole field, so the
 * grid fills from the middle outward as the estimate climbs. Each dot's radius
 * is the field there. Opacity cannot vary within one path, so the fade at the
 * edge comes from radius alone, which reads the same at this size.
 */
function fieldPath(width: number, height: number, progressIn: number, time: number): SkPath {
    const path = Skia.Path.Make();
    const cell = Math.min(width, height) / COLUMNS;
    const columns = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const progress = Math.max(0, Math.min(1, progressIn));
    const blobs = [
        { x: 0.55 + 0.22 * Math.sin(time * 0.37), y: 0.4 + 0.2 * Math.cos(time * 0.29), r: 0.42 },
        { x: 0.35 + 0.25 * Math.cos(time * 0.23), y: 0.6 + 0.22 * Math.sin(time * 0.41), r: 0.34 },
        { x: 0.6 + 0.3 * Math.sin(time * 0.19 + 1.7), y: 0.55 + 0.28 * Math.cos(time * 0.17 + 0.6), r: 0.28 },
    ];
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const x = (column + 0.5) / columns;
            const y = (row + 0.5) / rows;
            let field = 0;
            for (const blob of blobs) {
                const dx = (x - blob.x) / blob.r;
                const dy = (y - blob.y) / blob.r;
                field += Math.exp(-(dx * dx + dy * dy) * 1.6);
            }
            const centre = 1 - Math.min(1, Math.hypot(x - 0.5, y - 0.5) / 0.75);
            const value = Math.min(1, 0.12 + field * 0.55 + progress * (0.25 + 0.6 * centre));
            if (value < 0.16) continue;
            path.addCircle((column + 0.5) * cell, (row + 0.5) * cell, cell * 0.36 * value);
        }
    }
    return path;
}

const styles = StyleSheet.create(theme => ({
    frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.surface },
    badge: {
        position: 'absolute', right: 12, bottom: 12, height: 28, paddingHorizontal: 12,
        borderRadius: 999, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    badgeText: { color: theme.colors.text, fontSize: 15, fontVariant: ['tabular-nums'], ...Typography.default('semiBold') },
}));
