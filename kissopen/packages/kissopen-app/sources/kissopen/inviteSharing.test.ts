import { describe, expect, it } from 'vitest';
import { inviteShareContent } from './inviteSharing';

describe('inviteShareContent', () => {
    const link = 'https://api.firstcache.cc/i/ABCD23';
    it('attaches the referral URL once in the iOS share sheet', () => {
        expect(inviteShareContent('ios', 'Try KissOpen with me', link)).toEqual({
            message: 'Try KissOpen with me', url: link,
        });
    });
    it('includes the referral URL in Android and web share text', () => {
        for (const platform of ['android', 'web']) {
            expect(inviteShareContent(platform, 'Try KissOpen with me', link)).toEqual({
                message: `Try KissOpen with me\n${link}`,
            });
        }
    });
    it('retains referral query parameters from the server', () => {
        const tracked = `${link}?ref=ABCD23&utm_source=invite`;
        expect(inviteShareContent('ios', 'Invite', tracked).url).toBe(tracked);
    });
    it('shares the logo attachment while preserving the invite link in the text on iOS', () => {
        const logo = 'file:///app/cache/brand-logo.png';
        expect(inviteShareContent('ios', 'Try KissOpen with me', link, logo)).toEqual({
            message: `Try KissOpen with me\n${link}`, url: logo,
        });
    });
    it('keeps tracked referral links when attaching an image', () => {
        const tracked = `${link}?ref=ABCD23&utm_source=invite`;
        expect(inviteShareContent('ios', 'Invite', tracked, 'file:///app/cache/logo.png').message).toContain(tracked);
    });
    it('rejects remote images, non-image files and invalid logo URLs', () => {
        for (const invalid of ['https://example.com/logo.png', 'file:///app/cache/account.json', 'file://remote/logo.png', 'file:///app/cache/logo.png?extra=1', 'not-a-file']) {
            expect(() => inviteShareContent('ios', 'Invite', link, invalid)).toThrow();
        }
    });
    it('does not replace the referral link with an unsupported attachment on Android', () => {
        expect(inviteShareContent('android', 'Invite', link, 'file:///app/cache/logo.png')).toEqual({
            message: `Invite\n${link}`,
        });
    });
    it('rejects malformed, executable and credential-bearing links', () => {
        for (const invalid of ['', 'not-a-link', 'javascript:alert(1)', 'file:///tmp/invite', 'https://user:secret@example.com/i/code']) {
            expect(() => inviteShareContent('ios', 'Invite', invalid)).toThrow();
        }
    });
});
