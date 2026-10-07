# KISSOPEN 加载动画

规则：位移上限 2 单位（缝宽 12 的 17%），缝全程不闭合；缓动 cubic-bezier(.4,0,.2,1)，周期 1.6s；24px 以下改用左右交替呼吸；prefers-reduced-motion 下静止。

- kissopen-loader-accent.svg / -light.svg / -currentcolor.svg — 主加载，SMIL 自带动画（两端靠近 2 单位后返回，周期 1.6s），可直接 <img src> 或内联
- kissopen-loader-relay-light.svg — 启动屏变体，两端接力发亮（opacity 1↔0.22），1.8s，标志不动
- kissopen-progress.svg — 确定进度模板，改 clipPath 矩形的 y：47.5 = 0%，14.5 = 100%
- kissopen-loader.html — CSS 版（随 currentColor，含 reduced-motion 分支），推荐用于 Web 与 Electron

注：<img> 引用 SVG 时 currentColor 不生效，需内联使用。

## 两种载体怎么选

| | SMIL 版（4 个 .svg） | CSS 版（kissopen-loader.html） |
| --- | --- | --- |
| 用法 | `<img src>` 或内联，零依赖、不动 JS | 内联片段，随 `currentColor` |
| 尺寸 | 建议 ≥ 24px | 任意，含 24px 以下 |
| 小尺寸表现 | 固定为靠近/返回 | 24px 以下自动改用左右交替呼吸（1.2s，opacity 1↔0.28） |
| `prefers-reduced-motion` | **不支持**（SMIL 无法用媒体查询关闭） | 支持，直接静止 |
| 适用 | 邮件、文档、第三方系统里贴图就能动 | Web / Electron，读屏与减弱动效场景 |

SMIL 与 CSS 的关键帧数值完全一致（0%/100% 位移 0，46%/58% 位移 ±2，缓动 `cubic-bezier(.4,0,.2,1)`；接力版 1.8s、`ease-in-out`），两版可以混用不会打架。需要尊重"减弱动效"偏好时请改用 CSS 版。
