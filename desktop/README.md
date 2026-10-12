# Lain42 剧情工坊

离线桌面工作台：编辑/导入 LetsGal DSL → 原 CLI 编译 → 对白/分支预览 → 工程 ZIP。
Windows WebView2 原生窗口；Linux 使用同一个本机浏览器工作台。
随包携带 Node 单文件引擎和 Python/FastAPI；不需要另装 Node 或 Python。
文件和脚本保留在临时本机工作区。退出或清空会删除工作区，请先导出工程。

预览覆盖对白、旁白、背景和分支/片段调用。声音、粒子、复杂演出和官方引擎效果
不会伪装成完成；界面明确列出未预览项。工程还需要在 LetsGal Studio 中核对演出，
本工具不附官方引擎或模板素材，不生成独立游戏 EXE。

选择合法自有素材。背景引用例如 `!scene 房间 backgrounds/room.png`，导入时把 PNG
映射至相同相对路径。只支持 PNG/JPEG；本阶段不接受压缩包、脚本、远程 URL 或音频。
网络上的 AI 剧本可复制进来，不内置付费模型服务或把“AI”当作可用能力承诺。

安装包未签名。WebView2 为 Microsoft 官方桌面运行时；需要首次安装。
产品构建/冻结/测试仅 GitHub Actions，验证失败不会正式发布。

CLI 编译器：本仓库 MIT。原 Node.js/Python/前端依赖许可随安装包提供。
FastAPI/WebView 基础封装复用 lilyco-42/mirage-tank（MIT），见 SHARED-SOURCE-LICENSE。
