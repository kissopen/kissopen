import * as React from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the on-screen keyboard is up.
 *
 * iOS announces the keyboard before it moves ("will"), which lets a layout
 * change ride along with the animation; Android only says so once it has
 * moved ("did"). The web has no such keyboard, so there it is never up.
 */
export function useKeyboardShown(): boolean {
    const [shown, setShown] = React.useState(false);
    React.useEffect(() => {
        if (Platform.OS === 'web') return;
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
        return () => { show.remove(); hide.remove(); };
    }, []);
    return shown;
}
