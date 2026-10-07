// Distribution identity is selected at build time, never by language or IP.
function resolveAppMarket(env = process.env) {
    const market = env.APP_MARKET || 'global';
    const variant = env.APP_ENV || 'development';
    if (!['global', 'cn'].includes(market)) throw new Error('APP_MARKET must be global or cn');
    if (!['development', 'preview', 'production'].includes(variant)) throw new Error('Invalid APP_ENV');
    const brand = market === 'cn' ? '一起卷' : 'KissOpen';
    const slug = market === 'cn' ? 'yiqijuan' : 'kissopen';
    // The bare kissopen:// scheme and KISSOPEN_EAS_PROJECT_ID belong to the
    // legacy CLI and OTA project, so the global build uses its own names.
    const bundleBase = market === 'cn' ? 'com.yiqijuan.app' : 'com.kissopen.opensource.app';
    const schemeBase = market === 'cn' ? 'yiqijuan' : 'kissopen-oss';
    const prefix = market === 'cn' ? 'YIQIJUAN' : 'KISSOPEN_GLOBAL';
    const suffix = variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev';
    const projectId = env[`${prefix}_EAS_PROJECT_ID`];
    const linkHost = env[`${prefix}_APP_LINK_HOST`];
    if (env.KISSOPEN_GLOBAL_EAS_PROJECT_ID && env.KISSOPEN_GLOBAL_EAS_PROJECT_ID === env.YIQIJUAN_EAS_PROJECT_ID) throw new Error('Markets must use different EAS projects');
    if (env.KISSOPEN_GLOBAL_APP_LINK_HOST && env.KISSOPEN_GLOBAL_APP_LINK_HOST === env.YIQIJUAN_APP_LINK_HOST) throw new Error('Markets must use different app-link hosts');
    if (projectId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) throw new Error(`${prefix}_EAS_PROJECT_ID must be a UUID`);
    if (linkHost && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(linkHost)) throw new Error(`${prefix}_APP_LINK_HOST must be a hostname, not a URL`);
    return {
        market, variant, brand, slug, projectId, linkHost,
        bundleId: `${bundleBase}${suffix}`,
        scheme: schemeBase + (variant === 'production' ? '' : variant === 'preview' ? '-preview' : '-dev'),
        name: brand + (variant === 'production' ? '' : variant === 'preview' ? ' (Preview)' : ' (Dev)'),
        channel: `${market}-${variant}`,
        runtimeVersion: `${market}-${variant}-sync-2`,
    };
}
module.exports = { resolveAppMarket };
