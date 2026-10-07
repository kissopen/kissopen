/** Share the server-issued referral URL, never a reconstructed generic link. */
export function inviteShareContent(platform: string, message: string, link: string, logoUri?: string) {
    const url = new URL(link);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Invalid invitation link');
    }
    if (platform === 'ios' && logoUri) {
        const logo = new URL(logoUri);
        if (logo.protocol !== 'file:' || logo.host || logo.search || logo.hash || !logo.pathname.toLowerCase().endsWith('.png')) {
            throw new Error('Invalid invitation logo');
        }
        // RN's iOS bridge passes a local file URL as an activity attachment.
        // Its single URL slot holds the image; keep the referral link in the text.
        return { message: `${message}\n${url.href}`, url: logo.href };
    }
    // Without an image, iOS has a dedicated URL attachment. Android consumes text.
    return platform === 'ios'
        ? { message, url: url.href }
        : { message: `${message}\n${url.href}` };
}
