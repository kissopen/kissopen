const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

/**
 * Adopts the UIKit scene-based life cycle on iOS.
 *
 * Apps built against the iOS 27 SDK are killed at launch unless they adopt it:
 * "Application failed to launch: UIScene life cycle is required for apps built with this SDK."
 * Neither React Native (0.83) nor Expo (SDK 55) generates a scene-based AppDelegate, so the
 * app has to do it itself.
 *
 * Adding the Info.plist manifest alone is not enough and fails in a way that reads like
 * success: the app launches to a black screen, because the window the template creates with
 * `UIWindow(frame:)` has no `windowScene` to attach to. The window must be built from the
 * scene, which means moving `startReactNative` into a UIWindowSceneDelegate.
 *
 * Keep this in sync with ios/KISSOPEN/AppDelegate.swift, which carries the same change for
 * the already-generated project (prebuild regenerates ios/ from scratch).
 */

const SCENE_DELEGATE_CLASS_NAME = '$(PRODUCT_MODULE_NAME).SceneDelegate';

// The block Expo's prebuild template puts in `application(_:didFinishLaunchingWithOptions:)`.
const TEMPLATE_WINDOW_BLOCK = `    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const SCENE_AWARE_LAUNCH_BLOCK = `    reactNativeDelegate = delegate
    reactNativeFactory = factory
    reactNativeLaunchOptions = launchOptions

    // The window is created in \`SceneDelegate.scene(_:willConnectTo:options:)\` instead:
    // apps built against the iOS 27 SDK must adopt the UIScene life cycle, and a window
    // made here has no \`windowScene\` to attach to, so it would never appear.
`;

const LAUNCH_OPTIONS_PROPERTY = `  var reactNativeFactory: RCTReactNativeFactory?

  /// Kept so \`SceneDelegate\` can hand them to React Native when the scene connects.
  var reactNativeLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?
`;

const SCENE_DELEGATE_SOURCE = `
/// Apps built against the iOS 27 SDK must adopt the UIScene life cycle or they are killed at
/// launch. UIKit now owns the UI life cycle per scene, so the window and the React Native root
/// are created here instead of in \`AppDelegate\`.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // expo-dev-client and some native modules still read the app delegate's window.
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: Self.launchOptions(from: appDelegate, connectionOptions: connectionOptions))
  }

  // MARK: - Linking
  //
  // Once an app adopts the scene life cycle, UIKit stops calling the UIApplicationDelegate URL
  // and user-activity methods -- which is exactly where RCTLinkingManager and the Expo app
  // delegate subscribers listen. Hand the scene's events back to them.

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace
      ]
      if let sourceApplication = context.options.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }

      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }

  /// A cold launch from a link is delivered in \`connectionOptions\`, but \`RCTLinkingManager\`
  /// reads the initial URL out of the bridge's launch options. Without putting it back there,
  /// \`Linking.getInitialURL()\` resolves to null on the first launch from a link.
  private static func launchOptions(
    from appDelegate: AppDelegate,
    connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var options = appDelegate.reactNativeLaunchOptions ?? [:]

    if let url = connectionOptions.urlContexts.first?.url {
      options[.url] = url
    } else if let userActivity = connectionOptions.userActivities.first,
              userActivity.activityType == NSUserActivityTypeBrowsingWeb {
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity
      ]
    }

    return options.isEmpty ? nil : options
  }
}
`;

const withSceneManifest = (config) =>
  withInfoPlist(config, (infoPlistConfig) => {
    infoPlistConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS_NAME,
          },
        ],
      },
    };

    return infoPlistConfig;
  });

const withSceneDelegate = (config) =>
  withAppDelegate(config, (appDelegateConfig) => {
    const { modResults } = appDelegateConfig;

    if (modResults.language !== 'swift') {
      throw new Error(
        `withUISceneLifecycle: expected a Swift AppDelegate, got "${modResults.language}".`
      );
    }

    // Already adopted -- prebuild was run twice, or the template caught up with us.
    if (modResults.contents.includes('class SceneDelegate')) {
      return appDelegateConfig;
    }

    if (!modResults.contents.includes(TEMPLATE_WINDOW_BLOCK)) {
      throw new Error(
        'withUISceneLifecycle: could not find the window setup block in AppDelegate.swift. ' +
          'The Expo template changed -- update TEMPLATE_WINDOW_BLOCK in ' +
          'plugins/withUISceneLifecycle.js, and check whether Expo now adopts the UIScene ' +
          'life cycle itself (in which case delete this plugin).'
      );
    }

    modResults.contents =
      modResults.contents
        .replace(TEMPLATE_WINDOW_BLOCK, SCENE_AWARE_LAUNCH_BLOCK)
        .replace(
          '  var reactNativeFactory: RCTReactNativeFactory?\n',
          LAUNCH_OPTIONS_PROPERTY
        ) + SCENE_DELEGATE_SOURCE;

    return appDelegateConfig;
  });

const withUISceneLifecycle = (config) => withSceneDelegate(withSceneManifest(config));

module.exports = withUISceneLifecycle;
