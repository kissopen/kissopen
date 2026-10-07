import { MMKV } from 'react-native-mmkv';
import { communityOrigin, communityRelayOrigin } from '@/communityServer';

// Separate MMKV instance for server config that persists across logouts
const serverConfigStorage = new MMKV({ id: 'kissopen-oss-server-config' });

const SERVER_KEY = 'custom-server-url';
const LOG_SERVER_KEY = 'log-server-url';
const USE_CUSTOM_SERVER_FOR_VOICE_KEY = 'use-custom-server-for-voice';
const DEFAULT_SERVER_URL = communityRelayOrigin;

export function getServerUrl(): string {
    return communityOrigin(serverConfigStorage.getString(SERVER_KEY) || DEFAULT_SERVER_URL);
}

export function rewriteLoopbackHost(url: string): string {
    try {
        const target = new URL(url);
        if (target.hostname !== 'localhost' && target.hostname !== '127.0.0.1' && target.hostname !== '::1') {
            return url;
        }
        const reachable = new URL(getServerUrl());
        target.protocol = reachable.protocol;
        target.host = reachable.host;
        return target.toString();
    } catch {
        return url;
    }
}

export function setServerUrl(url: string | null): void {
    if (url && url.trim()) {
        serverConfigStorage.set(SERVER_KEY, communityOrigin(url.trim()));
    } else {
        serverConfigStorage.delete(SERVER_KEY);
    }
}

export function shouldUseCustomServerForVoice(): boolean {
    return isUsingCustomServer() && serverConfigStorage.getBoolean(USE_CUSTOM_SERVER_FOR_VOICE_KEY) === true;
}

export function setUseCustomServerForVoice(enabled: boolean): void {
    if (enabled) {
        serverConfigStorage.set(USE_CUSTOM_SERVER_FOR_VOICE_KEY, true);
    } else {
        serverConfigStorage.delete(USE_CUSTOM_SERVER_FOR_VOICE_KEY);
    }
}

export function getVoiceServerUrl(): string {
    return getServerUrl();
}

export function getLogServerUrl(): string | null {
    return serverConfigStorage.getString(LOG_SERVER_KEY) ||
           process.env.EXPO_PUBLIC_COMMUNITY_LOG_SERVER_URL ||
           null;
}

export function setLogServerUrl(url: string | null): void {
    if (url && url.trim()) {
        serverConfigStorage.set(LOG_SERVER_KEY, url.trim());
    } else {
        serverConfigStorage.delete(LOG_SERVER_KEY);
    }
}

export function isUsingCustomServer(): boolean {
    return getServerUrl() !== DEFAULT_SERVER_URL;
}

export function getServerInfo(): { hostname: string; port?: number; isCustom: boolean } {
    const url = getServerUrl();
    const isCustom = isUsingCustomServer();
    
    try {
        const parsed = new URL(url);
        const port = parsed.port ? parseInt(parsed.port) : undefined;
        return {
            hostname: parsed.hostname,
            port,
            isCustom
        };
    } catch {
        // Fallback if URL parsing fails
        return {
            hostname: url,
            port: undefined,
            isCustom
        };
    }
}

export function validateServerUrl(url: string): { valid: boolean; error?: string } {
    if (!url || !url.trim()) {
        return { valid: false, error: 'Server URL cannot be empty' };
    }
    
    try {
        communityOrigin(url.trim());
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error instanceof Error ? error.message : 'Invalid URL format' };
    }
}
