# letsgal-ai — AI 辅助 LetsGal Studio 创作工具链

> 从零逆向 LetsGal Studio 工程格式，把它变成 **AI 可以直接创作** 的工具：
> 一行式故事 DSL → 完整可运行工程（章节/角色/场景/分支/演出），CLI 与 MCP 双通道，零依赖。

- 格式参考（逆向自官方模板 + 1.11.0 安装包）：[docs/letsgal-format.md](docs/letsgal-format.md)
- 故事 DSL 规范：[docs/STORY-DSL.md](docs/STORY-DSL.md)

## 为什么

LetsGal Studio 是**桌面 GUI 编辑器**（无 MCP、无 CLI），但它的一切都是磁盘上的普通 JSON。
本项目把该格式完全程序化：
- **AI 生成剧本** → 一行命令编译成工程 → Studio 打开即玩（可再精修演出/素材）
- 格式完全对齐官方（project.json / characters.json / scenes.json / chapters/*.json / assets/.manifest.json），
  Studio 打开零报错，自动修复合入角色表情、替换素材都自然

## 快速开始

```bash
# 安装（无需依赖，直接 clone 或 npm link）
npm link                    # 或 node bin/letsgal-ai.js …

# 1. 初始化工程骨架
letsgal-ai init my-game --name "时间的河流"

# 2. 写故事（见 examples/example.dsl）→ 编译
letsgal-ai build story.dsl -o my-game --name "时间的河流"

# 3. 校验
letsgal-ai validate my-game

# 4. 用 LetsGal Studio 打开 my-game → 播放
```

## MCP（AI Agent 直接调用）

```bash
letsgal-ai mcp     # stdio JSON-RPC 2.0，零依赖实现
```

暴露工具：

| 工具 | 说明 |
|---|---|
| `letsgal_init` | 初始化工程骨架 |
| `letsgal_compile` | 故事 DSL → 完整工程（自动注册角色/场景） |
| `letsgal_add_dialogue` / `letsgal_add_narration` | 追加对白/旁白 Block |
| `letsgal_validate` | 校验结构 + 资产引用 |
| `letsgal_register_asset` | 登记资产到 .manifest.json |
| `letsgal_list_chapters` | 章节/Fragment 统计 |

任何 MCP 客户端（Claude Code / DSH / 自研）配置 `node bin/letsgal-ai.js mcp` 即可。

## CLI

```
letsgal-ai init <dir> [--name 标题]
letsgal-ai build <story.dsl> -o <dir> [--name 标题]
letsgal-ai validate <dir>
letsgal-ai list <dir>
letsgal-ai mcp
```

## 作为库使用

```js
import { compileStory, initProject, validateProject, applyCharacterFlow, dialogue, narration, scene } from '@lilyco-42/letsgal-ai';
```

## 开发

```bash
npm test        # 冒烟测试：init → build → validate → MCP 握手
```

## 授权与致谢

- 本工具 MIT；不含素材。生成的工程可直接使用 LetsGal Studio 官方模板素材（随引擎提供）
- 逆向依据：LetsGal Studio 1.11.0（Windows）安装包 + 官方模板工程

## Roadmap
- [ ] Ren'Py 风格代码 ↔ Block 双向转换（对齐官方代码编辑器语法）
- [ ] 无头构建（复用官方 build-worker 产出 web 版）
- [ ] lilyco（Rust）原生组件：`lilyco-letsgal`（见 docs/lyco-integration.md）
