# KissOpen

开源的 AI Agent 工作空间，连接桌面、手机和网页。使用自己的模型，在电脑上执行，
随时从手机继续同一份工作。

[官网](https://kissopen.com) · [网页版](https://app.kissopen.com) · [English](README.md)

## 功能

- 对话、项目、资料库和内置浏览器。
- 自定义服务商：API URL + Key，拉取并选择模型。
- 自定义主题、本地模型制作主题、账号主题广场。
- 本地插件安装、启停和卸载。
- 语义创建定时任务，由本地 Agent 保存和执行。
- 用户名密码、可选 2FA，以及 GitHub / Google / NodeLoc OAuth。
- 手机和桌面同账号关联。访问本地文件、执行任务时需要电脑在线。

模型推理由你配置的服务商提供，工具执行、插件和定时任务由本地 Agent 管理。

## 项目结构

| 仓库 | 内容 |
| --- | --- |
| [kissopen](https://github.com/kissopen/kissopen) | 桌面、手机/Web、共享同步层、品牌和官网 |
| [kissopen-agent](https://github.com/kissopen/kissopen-agent) | 本地 Agent、SDK、模型、工具、终端、定时执行器 |
| [kissopen-server](https://github.com/kissopen/kissopen-server) | 账号、OAuth、中继、设备 RPC、资料、主题和插件目录 |

## 参与贡献

欢迎提交 Issue、改进建议和 Pull Request，详见 [贡献指南](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) · [第三方版权声明](NOTICE.md)
