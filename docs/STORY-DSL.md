# 故事 DSL 规范（Story DSL）

面向 AI / 文本作者的一行式剧本格式，编译为 LetsGal 章节 Block。
特点：**格式即剧本**——作者按此写，AI 按此生成，编译即得可运行工程。

## 行类型

| 语法 | 含义 | 示例 |
|---|---|---|
| `# 章节名` | 新章节 | `# 序章·梦` |
| `## Fragment名` | 新 Fragment（分支目标） | `## qa_lilyco` |
| `!指令 [参数]` | 导演指令（见下） | `!scene 雪域 backgrounds/户外雪地.png` |
| `角色：台词` | 对白 | `我：云枢智创，这个名字怎么样？` |
| `角色(表情)：台词` | 带表情对白 | `穗(微笑)：我们还会再见的，对吧？` |
| `旁白：文本` | 旁白 | `旁白：时间的河流缓缓流向彼方。` |
| `（动作）` | 舞台说明（→旁白） | `（他惊醒过来）` |
| `; 注释` | 注释 | `; 转场到房间` |

## 指令

| 指令 | 参数 | 说明 |
|---|---|---|
| `!curtain close\|open` | `dur=1000` | 幕布 |
| `!scene 名 uri` | `td=500` | 场景切换（自动注册到 scenes.json） |
| `!cg 名 uri` | `td=800` | CG 插画（同 scene） |
| `!bgm uri` | `vol=45 loop fade=0` | BGM |
| `!se uri` | `vol=60 loop` | 音效 |
| `!voice uri` | `vol=80` | 语音 |
| `!stopbgm` / `!stopse` | `fade=1000` | 停止音频 |
| `!particle PRESET uri` | `mode=show fadeIn=500 fadeOut=500` | 粒子（LIGHT_SNOW/MODERATE_SNOW/SAKURA…） |
| `!camera` | `zoom=1.1 dur=3000 offsetX=0 easing=easeInOut` | 镜头 |
| `!resetcamera` | `dur=800` | 复位镜头 |
| `!wait ms` | `input=true` 等待点击 | 等待 |
| `!float 文本` | `size=42 dur=2000` | 漂浮字（菜单/标题） |
| `!title` | — | 标题画面（slot:internal.system.title） |
| `!choice 选项->frag \| 选项2->frag` | — | 分支（frag 为 `##` 名称） |
| `!call frag` | `id=xxx` 指定 id | 调用 Fragment（执行完返回） |
| `!comment 文本` | — | 编辑器注释 |
| `!end` | — | 回到入口（游戏结束） |

## 语义约定
- 角色首次出现自动注册到 characters.json（无立绘；立绘在 Studio 或 `!portrait` 未来扩展中补充）
- 场景（`!scene`/`!cg`）自动注册到 scenes.json
- **角色流自动处理**：同场景同角色持续在场，换人/转场自动退场（`keepCharacter` 后处理）
- 资产路径相对 `assets/`；未登记的资产在 validate 中提示（warnings，不影响 ok）

## 完整示例
见 `examples/example.dsl`（雪景开场 → 清晨 → 路演分支 → 尾声）。
