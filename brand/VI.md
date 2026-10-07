# KISSOPEN 标志资源

几何：64 画布，楔形顶点 x=26 / x=38，缝宽 12 单位（不可改）；描边 5、圆角接合，填色＝描边色。
墨迹范围 x 13.5–50.5、y 14.5–49.5（37×35），所有尺寸按墨迹外缘计量。

## svg/
- kissopen-mark-currentcolor.svg — 随文字色，界面内联首选
- kissopen-mark-accent.svg  #9184D9 — 页面与品牌物料
- kissopen-mark-light.svg   #F3F5FE — 深底反白
- kissopen-mark-dark.svg    #1B1D29 — 浅底/印品
- kissopen-icon-app.svg     512 应用图标（深靛底板 #262A60 + 浅色反白标志，圆角 23%，标志占边长 66%）

## icon/app/
16 / 32 / 48 / 64 / 128 / 256 / 512 / 1024 PNG，深靛底板版。
- macOS .icns、Windows .ico 从 1024 与 256 生成
- iOS AppIcon 用 1024；Android 自适应图标前景用 mark-light，背景色 #262A60

## icon/mark-light|accent|dark/
16 / 24 / 32 / 64 / 128 / 256 / 512 PNG，透明底单色标志。
- 最小使用尺寸 16px，再小不得使用
## icon/{macos,ios,android,windows,linux,web}/
各平台成品图标（.icns / .ico / favicon / AppIcon.appiconset / mipmap / Store logo / hicolor）。
投放目录与用法见 `icon/README.md`。
- 菜单栏、托盘、状态项用 `icon/macos/kissopen-menubarTemplate.png`（纯黑 + alpha，随系统反色）；`mark-light` 是 #F3F5FE 近白，浅色菜单栏上不可见，不要用在这里
- favicon、应用图标用 `icon/web/`、`icon/app/`（深靛底板版），不要用单色 mark-light 浅色版

## ../lockup/
横排与竖排锁定（SVG 12 份 + 常用尺寸 PNG），构造规则、色版与最小使用宽度见 `../lockup/README.md`

色值：Blurple #9184D9 · Deep Indigo #262A60 · Ground #161826 · Ink Light #E9E9ED · Ink Dark #1B1D29
