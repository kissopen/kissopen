const { execFileSync } = require('node:child_process');

const identity = require('./community-app.cjs').resolveCommunityApp();
const { variant, name, bundleId } = identity;
const consoleLoggingDefault = {
    development: true,
    preview: true,
    production: false,
}[variant];

function git(args) {
    try {
        return execFileSync('git', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || undefined;
    } catch {
        return undefined;
    }
}

function loadBuildMetadata() {
    const commitSha =
        process.env.KISSOPEN_BUILD_COMMIT_SHA ||
        process.env.EAS_BUILD_GIT_COMMIT_HASH ||
        process.env.GITHUB_SHA ||
        git(['rev-parse', 'HEAD']);
    const commitTimestamp =
        process.env.KISSOPEN_BUILD_COMMIT_TIMESTAMP ||
        (commitSha
            ? git(['show', '-s', '--format=%cI', commitSha])
            : git(['show', '-s', '--format=%cI', 'HEAD']));

    return {
        commitSha,
        commitTimestamp,
    };
}

const buildMetadata = loadBuildMetadata();

export default {
    expo: {
        name,
        slug: identity.slug,
        version: "0.2.29",
        runtimeVersion: identity.runtimeVersion,
        orientation: "default",
        // 卷 app icon: the framed mark (night gradient tile, purple roll, grey
        // paper back), full-bleed because iOS applies its own corner mask.
        icon: "./sources/assets/images/kissopen-icon.png",
        scheme: [identity.scheme],
        userInterfaceStyle: "automatic",
        ios: {
            buildNumber: "18",
            supportsTablet: true,
            bundleIdentifier: bundleId,
            ...(process.env.COMMUNITY_APPLE_TEAM_ID ? { appleTeamId: process.env.COMMUNITY_APPLE_TEAM_ID } : {}),
            config: {
                usesNonExemptEncryption: false
            },
            infoPlist: {
                NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone for voice conversations with AI.",
                NSLocalNetworkUsageDescription: "Allow $(PRODUCT_NAME) to find and connect to local devices on your network.",
                NSBonjourServices: ["_http._tcp", "_https._tcp"],
                // ATS:
                // - NSAllowsLocalNetworking: lets HTTP fetches reach LAN
                //   addresses (e.g. self-hosted server at 192.168.x.y) without
                //   forcing TLS. Production cloud server is HTTPS, so the
                //   default policy still applies there.
                // - In dev/preview only, allow arbitrary HTTP loads so a
                //   developer pointing the app at their machine doesn't have
                //   to ship a TLS cert just to test attachment uploads.
                NSAppTransportSecurity: variant === 'production'
                    ? { NSAllowsLocalNetworking: true }
                    : { NSAllowsLocalNetworking: true, NSAllowsArbitraryLoads: true }
            },
            ...(variant === 'production' && identity.linkHost
                ? { associatedDomains: [`applinks:${identity.linkHost}`] }
                : {})
        },
        android: {
            versionCode: 30,
            // The framed 卷 icon split into layers: the tile's night gradient
            // is the background, the lines the foreground. The foreground is
            // a 108dp canvas of which the launcher shows the middle 72dp; the
            // framed design is mapped onto that 72dp with its lines run out to
            // the canvas edge, so the launcher's mask cuts them the way the
            // rounded square does, and the spiral stays inside the 66dp safe
            // circle. Monochrome (themed icons) is the roll alone.
            adaptiveIcon: {
                foregroundImage: "./sources/assets/images/kissopen-adaptive-foreground.png",
                monochromeImage: "./sources/assets/images/kissopen-adaptive-monochrome.png",
                backgroundColor: "#262A60"
            },
            permissions: [
                "android.permission.RECORD_AUDIO",
                "android.permission.MODIFY_AUDIO_SETTINGS",
                "android.permission.ACCESS_NETWORK_STATE",
                "android.permission.POST_NOTIFICATIONS",
            ],
            blockedPermissions: [
                "android.permission.ACTIVITY_RECOGNITION",
                // Not using external storage/media access for now — blocks Google Play photo/video permission declaration
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE",
                "android.permission.READ_MEDIA_IMAGES",
                "android.permission.READ_MEDIA_VIDEO",
            ],
            package: bundleId,
            ...(process.env.COMMUNITY_GOOGLE_SERVICES_FILE ? { googleServicesFile: process.env.COMMUNITY_GOOGLE_SERVICES_FILE } : {}),
            intentFilters: variant === 'production' && identity.linkHost ? [
                {
                    "action": "VIEW",
                    "autoVerify": true,
                    "data": [
                        {
                            "scheme": "https",
                            "host": identity.linkHost,
                            "pathPrefix": "/"
                        }
                    ],
                    "category": ["BROWSABLE", "DEFAULT"]
                }
            ] : []
        },
        web: {
            bundler: "metro",
            output: "single",
            favicon: "./sources/assets/images/favicon.png"
        },
        plugins: [
            require("./plugins/withRevenueCatSwiftCompatibility.js"),
            require("./plugins/withEinkCompatibility.js"),
            require("./plugins/withUISceneLifecycle.js"),
            [
                "expo-router",
                {
                    root: "./sources/app"
                }
            ],
            "expo-updates",
            "expo-asset",
            "expo-localization",
            "expo-mail-composer",
            "expo-secure-store",
            "expo-web-browser",
            "react-native-vision-camera",
            "@more-tech/react-native-libsodium",
            "react-native-audio-api",
            "@livekit/react-native-expo-plugin",
            "@config-plugins/react-native-webrtc",
            [
                "expo-audio",
                {
                    microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone for voice conversations."
                }
            ],
            [
                "expo-location",
                {
                    locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to improve AI quality by using your location.",
                    locationAlwaysPermission: "Allow $(PRODUCT_NAME) to improve AI quality by using your location.",
                    locationWhenInUsePermission: "Allow $(PRODUCT_NAME) to improve AI quality by using your location."
                }
            ],
            [
                "expo-calendar",
                {
                    "calendarPermission": "Allow $(PRODUCT_NAME) to access your calendar to improve AI quality."
                }
            ],
            [
            "expo-camera",
                {
                    cameraPermission: "Allow $(PRODUCT_NAME) to access your camera to scan QR codes and share photos with AI.",
                    microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone for voice conversations.",
                    recordAudioAndroid: true
                }
            ],
            [
                "expo-image-picker",
                {
                    photosPermission: "Allow $(PRODUCT_NAME) to add photos you choose to AI conversations.",
                    cameraPermission: "Allow $(PRODUCT_NAME) to take photos for AI conversations."
                }
            ],
            [
                "expo-notifications",
                {
                    "enableBackgroundRemoteNotifications": true,
                    "icon": "./sources/assets/images/icon-notification.png"
                }
            ],
            [
                'expo-splash-screen',
                {
                    // KissOpen VI vertical lockup, no glow in either mode.
                    // The JS cover continues into the VI indigo/Ground gradient.
                    ios: {
                        image: "./sources/assets/images/kissopen-lockup-vertical-primary.png",
                        imageWidth: 168,
                        backgroundColor: "#262A60",
                        dark: {
                            image: "./sources/assets/images/kissopen-lockup-vertical-primary.png",
                            backgroundColor: "#262A60",
                        }
                    },
                    android: {
                        image: "./sources/assets/images/kissopen-mark-light.png",
                        imageWidth: 126,
                        backgroundColor: "#262A60",
                        dark: {
                            image: "./sources/assets/images/kissopen-mark-light.png",
                            backgroundColor: "#262A60",
                        }
                    }
                }
            ]
        ],
        updates: {
            enabled: Boolean(identity.projectId),
            ...(identity.projectId ? { url: `https://u.expo.dev/${identity.projectId}` } : {}),
            requestHeaders: {
                "expo-channel-name": identity.channel
            }
        },
        experiments: {
            typedRoutes: true,
            ...(process.env.KISSOPEN_WEB_BASE_PATH ? { baseUrl: process.env.KISSOPEN_WEB_BASE_PATH } : {})
        },
        extra: {
            router: {
                root: "./sources/app"
            },
            eas: {
                projectId: identity.projectId
            },
            app: {
                market: identity.market,
                brandName: identity.brand,
                bundleId: identity.bundleId,
                scheme: identity.scheme,
                // No commercial telemetry, purchases or hosted voice entitlement.
                postHogKey: undefined,
                revenueCatAppleKey: undefined,
                revenueCatGoogleKey: undefined,
                revenueCatStripeKey: undefined,
                elevenLabsAgentId: undefined,
                consoleLoggingDefault,
                buildCommitSha: buildMetadata.commitSha,
                buildCommitTimestamp: buildMetadata.commitTimestamp,
            }
        },
        ...(process.env.COMMUNITY_EXPO_OWNER ? { owner: process.env.COMMUNITY_EXPO_OWNER } : {})
    }
};
