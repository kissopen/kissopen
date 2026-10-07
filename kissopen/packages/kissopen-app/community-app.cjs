// Community builds never inherit commercial App Store or OTA identities.
function resolveCommunityApp(env = process.env) {
    const variant = env.COMMUNITY_APP_ENV || 'development';
    if (!['development', 'preview', 'production'].includes(variant)) {
        throw new Error('COMMUNITY_APP_ENV must be development, preview or production');
    }
    const suffix = variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev';
    const projectId = env.COMMUNITY_EAS_PROJECT_ID;
    const linkHost = env.COMMUNITY_APP_LINK_HOST;
    if (projectId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) {
        throw new Error('COMMUNITY_EAS_PROJECT_ID must be a UUID');
    }
    if (linkHost && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(linkHost)) {
        throw new Error('COMMUNITY_APP_LINK_HOST must be a hostname');
    }
    return {
        market: 'global', variant, brand: 'KissOpen', slug: 'kissopen',
        projectId, linkHost,
        bundleId: `com.kissopen.opensource.app${suffix}`,
        scheme: `kissopen-oss${variant === 'production' ? '' : `-${variant}`}`,
        name: `KissOpen${variant === 'production' ? '' : variant === 'preview' ? ' (Preview)' : ' (Dev)'}`,
        channel: `kissopen-oss-${variant}`,
        runtimeVersion: `kissopen-oss-${variant}-sync-2`,
    };
}
module.exports = { resolveCommunityApp };
