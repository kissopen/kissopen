/** Only an explicitly configured community service may receive account data. */
export function communityOrigin(value: string): string {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error('Use an HTTPS server origin, or HTTP on localhost for development.');
    }
    if (url.hostname === 'firstcache.cc' || url.hostname.endsWith('.firstcache.cc')) {
        throw new Error('Community builds cannot use the commercial account service.');
    }
    return url.origin;
}

export const communityRelayOrigin = communityOrigin(
    process.env.EXPO_PUBLIC_COMMUNITY_RELAY_URL || 'http://127.0.0.1:3005',
);
export const communityAccountOrigin = process.env.EXPO_PUBLIC_COMMUNITY_ACCOUNT_URL
    ? communityOrigin(process.env.EXPO_PUBLIC_COMMUNITY_ACCOUNT_URL)
    : undefined;
