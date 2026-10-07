const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { patchPodfile } = require('./withRevenueCatSwiftCompatibility');

test('adds a reproducible upstream Swift fix without changing other hooks', () => {
    const input = 'target do\n  post_install do |installer|\n    react_native_post_install(installer)\n  end\nend\n';
    const patched = patchPodfile(input);
    assert.ok(patched.includes('private init(stringRepresentation: String, underlyingColor: (any Sendable)?)'));
    assert.ok(patched.includes('react_native_post_install(installer)'));
    assert.equal(patchPodfile(patched), patched);
});

test('fails clearly when the Expo hook changes', () => {
    assert.throws(() => patchPodfile(''), /post_install/);
});

test('moves the existing initializer into the struct and survives repeated pod installs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kissopen-swift-test-'));
    const sourcePath = path.join(root, 'Pods/RevenueCat/Sources/Paywalls/PaywallColor.swift');
    const body = '    private init(stringRepresentation: String, underlyingColor: (any Sendable)?) {\n        self.stringRepresentation = stringRepresentation\n        self._underlyingColor = underlyingColor\n    }';
    try {
        fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
        fs.writeFileSync(sourcePath, `public struct PaywallColor {\n    public var stringRepresentation: String\n    fileprivate var _underlyingColor: (any Sendable)?\n}\n// MARK: - Public constructors\nprivate extension PaywallColor {\n${body}\n}\n`);
        const scriptPath = path.join(root, 'Podfile');
        fs.writeFileSync(scriptPath, 'def post_install\n  yield nil\nend\n' + patchPodfile('  post_install do |installer|\n  end\n'));
        for (let i = 0; i < 2; i++) {
            const result = spawnSync('ruby', [scriptPath], { encoding: 'utf8' });
            assert.equal(result.status, 0, result.stderr);
        }
        const result = fs.readFileSync(sourcePath, 'utf8');
        assert.ok(result.split('// MARK: - Public constructors')[0].includes(body));
        assert.equal(result.split(body).length, 2);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
