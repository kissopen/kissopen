# Local KissOpen iOS test build

Run from `kissopen/packages/kissopen-app` with Node, pnpm, Xcode and CocoaPods
available. Sign in to your own Apple developer team in Xcode. This produces a
device test build, not an App Store submission, and does not publish an update.

```sh
export EXPO_NO_DOTENV=1
export COMMUNITY_APP_ENV=preview
export EXPO_PUBLIC_COMMUNITY_RELAY_URL=https://kissopen.com
export EXPO_PUBLIC_COMMUNITY_ACCOUNT_URL=https://kissopen.com
export COMMUNITY_APPLE_TEAM_ID=YOUR_TEAM_ID

node --test plugins/withRevenueCatSwiftCompatibility.test.cjs
pnpm exec vitest run sources/components/onboarding/firstRunOnboarding.test.ts
pnpm typecheck
pnpm exec expo prebuild --platform ios --no-install
pod install --project-directory=ios

xcodebuild -workspace ios/KissOpenPreview.xcworkspace \
  -scheme KissOpenPreview -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/ios-test/KissOpen.xcarchive \
  -derivedDataPath build/ios-test/DerivedData \
  -jobs 3 -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$COMMUNITY_APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  IPHONEOS_DEPLOYMENT_TARGET=15.1 archive
```

Use Xcode Organizer to export the archive for **Debugging**, or supply your own
export-options plist to `xcodebuild -exportArchive`. Only devices included in the
development provisioning profile can install that IPA. Never commit signing
credentials, profiles or archives; `ios/`, `build/` and `dist/` are ignored.

The preview has an independent identity (`com.kissopen.opensource.app.preview`)
and cannot replace the commercial application. Its Release build includes the
JavaScript bundle and does not require Metro. Login providers depend on the
configured independent account server; desktop linking and encrypted-workspace
recovery are still required to access an existing workspace from a new phone.

On Xcode 27 the inherited RevenueCat SDK needs the upstream `PaywallColor`
initializer fix. The prebuild plugin applies that narrow, tested backport during
`pod install`; it does not enable purchases or configure RevenueCat credentials.
The deployment-target override also applies the supported iOS minimum to older
Pod targets. Keep these compatibility measures until the inherited SDKs are
upgraded and verified.
