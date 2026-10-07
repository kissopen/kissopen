import { t } from '@/text';

// Consumer API data can outlive a client-side brand rename. Normalize only
// product-owned labels at the API boundary; conversation content remains exact.
//
// Every older name is still live on the server side (磨刀客, then KISSOPEN), so
// all of them are mapped: the API keeps returning whatever brand the account
// was created under. They become the build's product name, independent of
// the user's language — 一起卷 in CN builds, WorPar in global builds.
const OLD_BRANDS = /磨刀客|一起卷|\b(?:WorPar|KISSOPEN|KissOpen|Kissopen)\b/gu;
const CJK = '[\\u3000-\\u303f\\u3400-\\u9fff\\uff00-\\uffef]';

export function kissopenBrandText(value: string): string {
    const brand = t('common.appName');
    const latin = /^[A-Za-z]/.test(brand);
    // 磨刀客 was written flush against what followed; a Latin word after the
    // name still needs a space ("WorPar Auto", "一起卷 Agent").
    let text = value
        .replace(OLD_BRANDS, brand)
        .replace(new RegExp(`${brand}(?=[A-Za-z0-9])`, 'gu'), `${brand} `);
    if (!latin) {
        // Chinese text takes no spaces between the name and Chinese characters.
        text = text
            .replace(new RegExp(`${brand}\\s+(?=${CJK})`, 'gu'), brand)
            .replace(new RegExp(`(${CJK})\\s+${brand}`, 'gu'), `$1${brand}`);
    }
    return text.trim();
}
