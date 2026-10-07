# KISSOPEN 平台成品图标

源图：`assets/svg/kissopen-icon-app.svg`（512 画布 · 底板 `#262A60` · 圆角 23% · 标志占边长 66%）
全部成品由该源图与 `assets/icon/app/kissopen-icon-1024.png` 生成，**未改动标志几何**（路径、描边、比例与 VI 页一致）。

## macos/

- `KISSOPEN.icns` — 11 个载体（16 / 32 / 64 / 128 / 256 / 512 / 1024，含 @2x 位），可直接替换 App 包内 `Contents/Resources/*.icns`
- `KISSOPEN.iconset/` — 10 个规格 PNG（16–1024），改图后用 `iconutil -c icns` 重新打包
- `kissopen-menubarTemplate.png` `@2x` — 菜单栏 / 托盘 / 状态项专用：**纯黑 + alpha、无底色**，文件名以 `Template` 结尾，系统会自动反色以适配深浅色菜单栏

## ios/

- `AppIcon.appiconset/` — 15 个尺寸（20 / 29 / 40 / 60 / 76 / 83.5 / 1024，含 @2x @3x）
- 全部为**不透明、无 alpha 通道**的方图，四角**不预圆角**（由系统磨圆）——源图的圆角与透明四角已用 `#262A60` 补齐，直接放入 Xcode `Assets.xcassets` 即可

## android/res/

- `mipmap-mdpi…xxxhdpi/ic_launcher.png` — 传统启动图标（48 / 72 / 96 / 144 / 192）
- `mipmap-*/ic_launcher_round.png` — 圆形启动图标
- `mipmap-*/ic_launcher_foreground.png` — 自适应图标前景层：108dp 画布，标志墨迹占画布 62%，落在 66dp 安全圆内，可被任意蒙版裁切
- `mipmap-anydpi-v26/ic_launcher.xml`、`ic_launcher_round.xml` — 自适应图标声明（含 monochrome 层，供 Android 13+ 主题图标）
- `values/colors.xml` — `ic_launcher_background` = `#262A60`
- 投放：把 `res/` 下的目录合并进工程同名目录

## windows/

- `kissopen.ico` — 16 / 24 / 32 / 48 / 64 / 128 / 256 多尺寸（PNG 压缩条目），供应用图标与安装包使用
- `StoreLogo.png`(50) · `Square44x44Logo` · `Square71x71Logo` · `Square150x150Logo` · `Square310x310Logo` · `Wide310x150Logo` — 磁贴与商店图形（透明底 + 浅色标志，标志墨迹占画布短边 62%）
- 建议磁贴底板色 `#262A60`；固定品牌色请在 `Package.appxmanifest` 中指定

## linux/

- `hicolor/<尺寸>/apps/kissopen.png`（16 / 24 / 32 / 48 / 64 / 128 / 256 / 512）
- `hicolor/scalable/apps/kissopen.svg`（与 `assets/svg/kissopen-icon-app.svg` 同一份矢量源）
- 投放：安装到 `/usr/share/icons/hicolor/…`，`.desktop` 中写 `Icon=kissopen`

## web/

- `favicon.ico`（16 / 32 / 48）· `favicon.svg`（64 画布轻量版，无内容凭证）· `favicon-16x16.png` `favicon-32x32.png` `favicon-48x48.png`
- `apple-touch-icon.png`（180，不透明）· `android-chrome-192x192.png` `android-chrome-512x512.png`
- `site.webmanifest`

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## 两点使用提醒

1. **菜单栏 / 托盘不要用 `mark-light`**：它是 `#F3F5FE`（近白），在浅色菜单栏上不可见，也不会随系统反色；请用 `macos/kissopen-menubarTemplate.png`。
2. **16px 下能否辨认需人眼或平台工具确认**：机器只能保证墨迹比例、圆角与色彩，观感请在 `assets/icon/app/kissopen-icon-16.png` 与 `web/favicon-16x16.png` 上核对。