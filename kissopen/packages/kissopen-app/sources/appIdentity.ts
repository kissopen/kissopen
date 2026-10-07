import Constants from 'expo-constants';

export type AppMarket = 'global' | 'cn';
const config = Constants.expoConfig?.extra?.app;
if (config?.market !== undefined && config.market !== 'global' && config.market !== 'cn') {
    throw new Error('Invalid application market');
}
export const appMarket: AppMarket = config?.market ?? 'global';
export const appBrand: string = config?.brandName ?? 'KissOpen';
export const appBundleId: string = config?.bundleId ?? 'com.kissopen.opensource.app.dev';
export const appScheme: string = config?.scheme ?? 'kissopen-oss-development';

// Continue accepting existing CLI QR codes, without registering the old OS
// scheme (which would let the two installed apps steal each other's links).
export function appLinkPayload(url: string, kind: 'account' | 'terminal'): string | undefined {
    for (const scheme of [appScheme, 'kissopen']) {
        const prefix = `${scheme}://${kind === 'account' ? '/' : ''}${kind}?`;
        if (url.startsWith(prefix)) return url.slice(prefix.length);
    }
    return undefined;
}
