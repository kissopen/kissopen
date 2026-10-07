/**
 * expo-router assigns `UIAction.subtitle` unconditionally, but that property comes
 * from `UIMenuElement` and is iOS 16+, unlike `UIMenu.subtitle` used a few lines above.
 * Xcode 27 rejects it against our 15.1 deployment target, so guard the assignment.
 */
const fs = require('fs');
const path = require('path');

const nodeModulesRoots = [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, '..', 'packages/kissopen-app/node_modules'),
];

const original = `    if let subtitle = subtitle {
      baseUiAction.subtitle = subtitle
    }
`;

const guarded = `    // UIMenuElement.subtitle (and therefore UIAction.subtitle) is iOS 16+, unlike UIMenu.subtitle.
    if #available(iOS 16.0, *) {
      if let subtitle = subtitle {
        baseUiAction.subtitle = subtitle
      }
    }
`;

let patched = 0;

for (const nodeModulesRoot of nodeModulesRoots) {
    const actionView = path.join(
        nodeModulesRoot,
        'expo-router/ios/LinkPreview/LinkPreviewNativeActionView.swift'
    );
    if (!fs.existsSync(actionView)) continue;

    const content = fs.readFileSync(actionView, 'utf8');
    if (!content.includes(original)) continue;

    fs.writeFileSync(actionView, content.replace(original, guarded), 'utf8');
    patched++;
}

if (patched > 0) {
    console.log(`[patch] Guarded expo-router UIAction.subtitle behind iOS 16 (${patched} file(s))`);
}
