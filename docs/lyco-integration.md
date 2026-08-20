# 接入 lilyco（Rust workspace）计划

lilyco 是 Rust workspace（`lilyco-core` / `lilyco-macros` / `lilyco-mcp` / `lilyco-cli` /
`lilyco-tui` / `lilyco-gui` / 各组件），核心模式：一个 `#[derive(App)]` 结构体自动获得
**CLI / TUI / Web / MCP** 四接口 + AI 可调（`--schema` / `--anthropic-tool` / `--mcp`）。

## 组件：`lilyco-letsgal`

在 workspace 中新增 crate，复用本仓库的格式知识（docs/letsgal-format.md），提供：

```
lletsgal --mode build <story.dsl> -o <dir> [--name 标题]   # 故事 DSL → 工程
lletsgal --mode init <dir> [--name 标题]                   # 骨架
lletsgal --mode validate <dir>                             # 校验
lletsgal --mcp                                             # MCP stdio（单工具 + mode 参数）
```

设计要点：
- **单 App + `mode: Mode`（ValueEnum）**：框架不支持子命令，用 mode 枚举实现多操作，
  且 `--mcp` 只暴露一个工具（参数带 mode），Agent 心智负担最小
- **核心逻辑放 `src/lib.rs`**（story DSL 解析 → serde_json::Value 块构建 → 写盘），
  三四个 [[bin]] 或单 bin 均可
- 复用本仓库测试故事（examples/example.dsl）做集成测试

## 步骤
1. 在 lilyco workspace `Cargo.toml` 注册 `lilyco-letsgal` 成员
2. `src/main.rs`：`#[derive(App)]` + run 函数（读 DSL → 构建 chapters/characters/scenes → 写盘 → ctx.done）
3. 依赖：`lilyco`(facade)、`lilyco-core`、`serde`、`serde_json`、`uuid`（或手写 md5→uuid）
4. 对齐本仓库 `lib/story.js` 的 DSL 语义与 `applyCharacterFlow` 角色流规则
5. `cargo build` + `cargo test`（冒烟：init→build→validate）

## 本仓库 Node 版与 Rust 版关系
- Node 版（本仓库）为**参考实现与快速落地**：零依赖、即 clone 即用、文档完整
- Rust 版（lilyco 组件）为**生态整合**：四接口统一、可被 DSH/Claude 等直接以 MCP 调用，
  与 lilyco-mcp/lilyco-vision 等组件同构
- 两者 DSL 与格式语义保持 1:1，可互相替换
