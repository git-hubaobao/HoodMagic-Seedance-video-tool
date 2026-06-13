# HoodMagic Seedance Video Tool

HoodMagic Seedance Video Tool 是一个桌面端 Seedance 视频生成工具，支持 HoodMagic 自有 API、Volcengine Ark API、素材库 asset:// 工作流，以及本地文件上传到对象存储后创建 Seedance 素材。

> 本仓库只包含可开源代码、文档、示例配置和构建脚本。请勿提交任何真实 API Key、AccessKey、Secret、Token、Bucket 私有配置、本地数据库、任务历史或素材缓存。

## 功能特性

- 文生视频
- 图生视频首帧
- 首尾帧
- 多模态参考图
- 参考视频
- 参考音频
- 素材库分组
- 素材上传
- asset:// 引用
- 对象存储上传
- 阿里云 OSS
- 火山 TOS 预留/支持情况
- 腾讯 COS 预留/支持情况
- 任务轮询
- 任务历史
- 下载视频
- 深色 UI
- 本地配置

## 技术栈

- Electron
- electron-vite
- React
- TypeScript
- pnpm workspace
- Vitest

## 安装依赖

~~~bash
pnpm install
~~~

## 本地开发启动

~~~bash
pnpm dev
~~~

## 构建桌面 App

~~~bash
pnpm build
pnpm package
~~~

生成安装包：

~~~bash
pnpm --filter video-tool dist
~~~

## 常用命令

~~~bash
pnpm typecheck
pnpm test
pnpm build
~~~

## API 配置说明

应用当前通过本地设置页保存服务商配置，支持：

- HoodMagic API：用于 HoodMagic 自有视频生成接口与素材库接口。
- Volcengine Ark API：用于火山方舟 Seedance 官方视频生成接口。

请在桌面应用的设置页填写你自己的服务地址和 API Key。本仓库中的 ".env.example" 与 "config.example.json" 只提供占位示例，不包含真实可用凭证。

## 素材库工作流

本地文件不会直接作为模型输入，而是先上传到对象存储，获得公网 URL，再调用 Seedance 素材库 API 创建素材，获得 asset:// 地址。素材状态变为 Active 后，才能用于视频生成。

推荐流程：

1. 在设置页配置 HoodMagic API。
2. 配置对象存储上传能力。
3. 在素材库中选择分组并上传本地图片、视频或音频。
4. 等待素材库返回 asset:// 地址并进入 Active 状态。
5. 在视频生成表单中引用该素材。

## 对象存储说明

当前支持或计划支持：

- Aliyun OSS：已接入上传流程。
- Volcengine TOS：预留配置入口，按版本进度接入。
- Tencent COS：预留配置入口，按版本进度接入。

生产环境推荐使用 STS 临时凭证，不建议在客户端分发长期 AccessKey、Secret 或 Token。

## 安全说明

不要提交：

- API Key
- AccessKey / Secret / Token
- 私有 Bucket、Endpoint、Public Domain
- 本地用户配置
- 本地数据库或 JSON 存储文件
- 任务历史
- 素材库真实数据或缓存
- 打包后的安装包
- 大体积视频、图片、音频素材

提交前请运行：

~~~bash
pnpm sync:open-source:dry
pnpm sync:open-source
~~~

## 项目结构

~~~text
.
├── apps/
│   └── video-tool/
│       ├── build/                  # Electron 图标资源
│       ├── scripts/                # 打包辅助脚本
│       ├── src/
│       │   ├── main/               # Electron 主进程
│       │   ├── preload/            # Preload bridge
│       │   ├── renderer/           # React Renderer 前端
│       │   ├── shared/             # 前后端共享类型
│       │   └── types/              # 本地类型声明
│       ├── electron-builder.yml
│       └── electron.vite.config.ts
├── packages/
│   ├── provider-adapters/          # HoodMagic / Volcengine provider 适配器
│   ├── storage/                    # 本地数据结构、默认配置与清洗逻辑
│   └── video-core/                 # 核心类型、模型与校验
├── config.example.json             # 本地 JSON 配置示例
├── .env.example                    # 环境变量示例
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
~~~

## 开源协议

MIT License。详见 [LICENSE](./LICENSE)。

## 免责声明

本项目不是火山引擎、字节跳动或 Volcengine 的官方产品。用户需要自行配置合法 API、对象存储、素材授权与合规使用流程，并自行承担生成内容与素材使用责任。

