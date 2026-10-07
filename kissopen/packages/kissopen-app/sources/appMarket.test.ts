import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { resolveAppMarket } = require('../app-market.cjs');
const { releaseCommand } = require('../scripts/mobile-release.cjs');

describe('market build identity', () => {
    it('isolates all six market/environment combinations', () => {
        const ids = [], schemes = [], channels = [], runtimes = [];
        for (const market of ['global', 'cn']) for (const variant of ['development', 'preview', 'production']) {
            const app = resolveAppMarket({ APP_MARKET: market, APP_ENV: variant });
            ids.push(app.bundleId); schemes.push(app.scheme); channels.push(app.channel); runtimes.push(app.runtimeVersion);
            expect(app.brand).toBe(market === 'cn' ? 'KissOpen' : 'KissOpen');
        }
        for (const values of [ids, schemes, channels, runtimes]) expect(new Set(values).size).toBe(6);
        expect(resolveAppMarket({ APP_ENV: 'production' }).bundleId).toBe('com.worpar.app');
        expect(resolveAppMarket({ APP_MARKET: 'cn', APP_ENV: 'production' }).bundleId).toBe('com.yiqijuan.app');
    });
    it('does not use the legacy OTA project and rejects malformed identities', () => {
        expect(resolveAppMarket({ KISSOPEN_EAS_PROJECT_ID: 'old' }).projectId).toBeUndefined();
        for (const env of [{ APP_MARKET: 'china' }, { APP_ENV: 'prod' }, { WORPAR_EAS_PROJECT_ID: 'old' }, { YIQIJUAN_APP_LINK_HOST: 'https://example.com', APP_MARKET: 'cn' }]) expect(() => resolveAppMarket(env)).toThrow();
    });
    it('uses exact market channels and never automatically submits a build', () => {
        const env = { APP_MARKET: 'global', APP_ENV: 'production', WORPAR_EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000001' };
        expect(releaseCommand('update', env).args).toContain('global-production');
        expect(releaseCommand('build', env).args).toEqual(['build', '--profile', 'global-production', '--platform', 'ios']);
        const config = require('../eas.json');
        expect(() => releaseCommand('submit', env, { ...config, submit: {} })).toThrow('ascAppId');
        expect(releaseCommand('submit', env, { ...config, submit: { 'global-production': { ios: { ascAppId: '1234567890', bundleIdentifier: 'com.worpar.app' } } } }).args).toContain('global-production');
        expect(() => releaseCommand('build', {})).toThrow('EAS project');
        const cn = { ...env, APP_MARKET: 'cn', YIQIJUAN_EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000002' };
        expect(releaseCommand('update', cn).args).toContain('cn-production');
    });
    it('targets the matching registered production App Store apps', () => {
        const config = require('../eas.json');
        expect(config.submit['global-production'].ios).toMatchObject({ ascAppId: '6818844945', bundleIdentifier: 'com.worpar.app' });
        expect(config.submit['cn-production'].ios).toMatchObject({ ascAppId: '6818844836', bundleIdentifier: 'com.yiqijuan.app' });
        for (const market of ['global', 'cn']) {
            const env = { APP_MARKET: market, APP_ENV: 'production', WORPAR_EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000001', YIQIJUAN_EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000002' };
            expect(releaseCommand('submit', env).args).toEqual(['submit', '--profile', market + '-production', '--platform', 'ios', '--latest']);
        }
        // Preview identities have no matching store records yet.
        expect(config.submit['global-preview-store'].ios.ascAppId).toBeUndefined();
        expect(config.submit['cn-preview-store'].ios.ascAppId).toBeUndefined();
    });
});

describe('application links', () => {
    it('accepts this build and legacy CLI QR codes, not the other app', async () => {
        vi.doMock('expo-constants', () => ({ default: { expoConfig: { extra: { app: { market: 'cn', scheme: 'yiqijuan-dev' } } } } }));
        const { appBrand, appLinkPayload } = await import('./appIdentity');
        expect(appBrand).toBe('KissOpen');
        expect(appLinkPayload('yiqijuan-dev:///account?key', 'account')).toBe('key');
        expect(appLinkPayload('kissopen://terminal?key', 'terminal')).toBe('key');
        expect(appLinkPayload('worpar://terminal?key', 'terminal')).toBeUndefined();
        expect(appLinkPayload('https://example.com/account?key', 'account')).toBeUndefined();
    });
});
