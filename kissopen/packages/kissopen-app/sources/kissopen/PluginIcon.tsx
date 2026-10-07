import * as React from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * A plugin's own mark, or the generic one when it has none.
 *
 * The mark comes from the package its author shipped, rendered to a small PNG
 * when the catalog was built and served from the same place the packages are.
 * A plugin installed from somewhere else has none, and so does one whose image
 * fails to load — both land on the puzzle piece rather than a hole in the row.
 */
export function PluginIcon({ uri, size = 44, radius }: {
    uri?: string;
    size?: number;
    /** Defaults to the rounded-square proportion the rest of the app uses. */
    radius?: number;
}) {
    const { theme } = useUnistyles();
    const [broken, setBroken] = React.useState(false);
    // A row re-used for another plugin must not keep the previous one's failure.
    React.useEffect(() => { setBroken(false); }, [uri]);

    const frame = {
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.27),
    };
    if (!uri || broken) {
        return <View style={[styles.frame, frame]}>
            <Ionicons name="extension-puzzle" size={Math.round(size * 0.5)} color={theme.colors.textSecondary} />
        </View>;
    }
    return <Image
        accessibilityIgnoresInvertColors
        source={{ uri }}
        style={[styles.frame, frame]}
        onError={() => setBroken(true)}
    />;
}

const styles = StyleSheet.create(theme => ({
    frame: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
    },
}));
