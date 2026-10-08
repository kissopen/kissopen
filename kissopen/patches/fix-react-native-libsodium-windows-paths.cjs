const fs = require('node:fs');
const path = require('node:path');

// CMake interprets backslashes in NODE_MODULES_DIR as string escapes on Windows.
// Normalize at the Gradle boundary, before passing the path to the CMake CLI.
const replacement = 'def nodeModules = findNodeModules(projectDir).replace(File.separator, "/")';
for (const relative of [
    'node_modules/@more-tech/react-native-libsodium/android/build.gradle',
    'packages/kissopen-app/node_modules/@more-tech/react-native-libsodium/android/build.gradle',
]) {
    const file = path.resolve(__dirname, '..', relative);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    if (before.includes(replacement)) continue;
    const after = before.replace(/^def nodeModules = findNodeModules\(projectDir\)\r?$/m, replacement);
    if (after === before) throw new Error('Unexpected libsodium Gradle configuration: ' + relative);
    fs.writeFileSync(file, after);
    console.log('[patch] normalized libsodium CMake paths in ' + relative);
}
