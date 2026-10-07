const { withPodfile } = require('@expo/config-plugins');

// Backport the designated initializer from purchases-ios 5.78.0 until the
// inherited native SDK is upgraded. Swift 6.4 otherwise synthesizes an
// initializer which conflicts with PaywallColor's public throwing initializer.
// https://github.com/RevenueCat/purchases-ios/blob/5.78.0/Sources/Paywalls/PaywallColor.swift
const MARKER = '# kissopen-revenuecat-swift-compatibility';
const PATCH = `    ${MARKER}
    color_path = File.join(__dir__, 'Pods/RevenueCat/Sources/Paywalls/PaywallColor.swift')
    if File.exist?(color_path)
      source = File.read(color_path)
      declaration = '    fileprivate var _underlyingColor: (any Sendable)?'
      initializer = 'private init(stringRepresentation: String, underlyingColor: (any Sendable)?)'
      unless source.split('// MARK: - Public constructors', 2).first.include?(initializer)
        raise 'RevenueCat PaywallColor changed; review the Swift compatibility patch' unless source.include?(declaration)
        body = "    " + initializer + " {\\n        self.stringRepresentation = stringRepresentation\\n        self._underlyingColor = underlyingColor\\n    }"
        raise 'RevenueCat designated initializer changed; review the Swift compatibility patch' unless source.include?(body)
        source = source.sub(body, '')
        File.chmod(0644, color_path)
        File.write(color_path, source.sub(declaration, declaration + "\\n\\n" + body))
      end
    end
`;

function patchPodfile(contents) {
    // Refresh our generated block when prebuild reuses an existing project.
    if (contents.includes(MARKER)) {
        contents = contents.replace(/^    # kissopen-revenuecat-swift-compatibility[\s\S]*?(?=^    react_native_post_install\(|^  end\n)/m, '');
    }
    const hook = '  post_install do |installer|\n';
    if (!contents.includes(hook)) throw new Error('Expected Expo Podfile post_install hook');
    return contents.replace(hook, hook + PATCH);
}

module.exports = (config) => withPodfile(config, (mod) => {
    mod.modResults.contents = patchPodfile(mod.modResults.contents);
    return mod;
});
module.exports.patchPodfile = patchPodfile;
