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

不包含商业版首页/项目看板、云端模型执行、订阅、账单和点数购买。

## 项目结构

| 仓库 | 内容 |
| --- | --- |
| [kissopen](https://github.com/kissopen/kissopen) | 桌面、手机/Web、共享同步层、品牌和官网 |
| [kissopen-agent](https://github.com/kissopen/kissopen-agent) | 本地 Agent、SDK、模型、工具、终端、定时执行器 |
| [kissopen-server](https://github.com/kissopen/kissopen-server) | 账号、OAuth、中继、设备 RPC、资料、主题和插件目录 |

开发启动及 Agent 构建/导入命令见 [英文 README](README.md#development)。桌面使用
版本化 SDK 与校验过的 Agent 安装包，不直接依赖旁边的源码目录。二进制、私钥、
账号凭证、用户工作区和旧商业后端不会提交到仓库。

这是首次公开的源码快照，仍有依赖安全告警，尚不代表完成正式发行安全审计。
服务端托管的工作区密钥可以由服务端恢复，不是“服务器无法解密”的端到端加密。
各目录保留上游版权和许可证，详见 [NOTICE](NOTICE.md)。
