import type { Router } from "expo-router"
import { useRouter } from "expo-router"
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { storage } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { trackSessionSwitched } from '@/track';
import { perfMark } from '@/utils/perfLog';
import { isRunningOnMac } from '@/utils/platform';

function sessionHref(sessionId: string): `/session/${string}` {
    return `/session/${encodeURIComponent(sessionId)}`;
}

export function prefetchSession(router: Router, sessionId: string) {
    // Native stack owns the off-screen instance. Web keeps its current
    // navigation behavior; mounting its file/sidebar tree is not a warmup.
    if (Platform.OS === 'web' || isRunningOnMac() || !storage.getState().sessions[sessionId]
        || storage.getState().currentViewingSessionId === sessionId) {
        return;
    }
    perfMark(`session-preload:${sessionId}`);
    sync.preloadSession(sessionId);
    try {
        router.prefetch(sessionHref(sessionId));
    } catch (error) {
        // Preparation is optional; a failed hint must not break the press.
        console.warn('Unable to prefetch session screen', error);
    }
}

export function navigateToSession(router: Router, sessionId: string) {
    perfMark(`session-open:${sessionId}`);
    const session = storage.getState().sessions[sessionId];
    if (session) {
        trackSessionSwitched(session);
    }

    router.push(sessionHref(sessionId));
}

export function useNavigateToSession() {
    const router = useRouter();
    return useCallback((sessionId: string) => {
        navigateToSession(router, sessionId);
    }, [router]);
}

/** Pressable owns tap cancellation, scrolling and long-press recognition. */
export function useSessionPressHandlers(sessionId: string) {
    const router = useRouter();
    const onPressIn = useCallback(() => prefetchSession(router, sessionId), [router, sessionId]);
    const onPress = useCallback(() => navigateToSession(router, sessionId), [router, sessionId]);
    return { onPressIn, onPress };
}
