# LetsGal Studio 工程格式参考（逆向自官方模板与 1.11.0 安装包）

> 本文件是 letsgal-ai 的核心资产：从 LetsGal Studio 官方模板章节、新建工程产物与
> 安装包（app.asar）逆向出的**精确工程格式**。基于它可完全程序化生成/修改 LetsGal 工程。

## 工程目录结构

```
<project>/
├── project.json              # 工程清单（分辨率/章节顺序/窗口…）
├── characters.json           # 角色表（version 2 + characters[]）
├── scenes.json               # 场景表（version 2 + scenes[]）
├── project.variables.json    # 变量表（可选，用到变量时创建）
├── chapters/*.json           # 每章一个文件
├── assets/                   # 素材库
│   └── .manifest.json        # 资产清单（hash → path/size/updatedAt）
├── ui/                       # 界面配置（@avg.internal.default-shell/*.json）
├── extensions/               # 扩展（avg.internal.default-shell 等）
├── config/fonts.json         # 字体配置
└── .studio/                  # 编辑器状态（自动生成）
```

## project.json

```json
{
  "id": "uuid",
  "version": "1.0.0",
  "engineVersion": "1.0.0",
  "name": "游戏名",
  "resolution": { "width": 1920, "height": 1080 },
  "backgroundColor": "#000000",
  "window": { "lockAspectRatio": false, "allowMaximize": true, "allowFullscreen": true, "launchMode": "windowed" },
  "cursor": { "mode": "system", "image": "", "imagePixelRatio": 1,
    "imageSize": { "width": 24, "height": 24 }, "hotspot": { "x": 0, "y": 0 },
    "fallback": "default", "css": "", "cssImagePixelRatio": 1, "cssImageSize": { "width": 24, "height": 24 } },
  "chapterOrder": ["开始", "序章"],
  "chapterFolders": [],
  "chapterTreeOrder": [ { "type": "chapter", "id": "章节uuid" } ],
  "extensionStorageVersion": 1,
  "extensions": {}, "extensionSettings": {},
  "dataBindings": {}, "dynamicVisualAssets": []
}
```

## characters.json

```json
{
  "version": 2,
  "globalSettings": {},
  "attributeTemplate": [],
  "characters": [
    { "id": "uuid", "name": "穗", "expressions": [
      { "name": "微笑", "assetPath": "characters/真琴裤袜外套眼镜微笑A.png" }
    ]}
  ]
}
```
- `expressions[].name` 被对白块的 `props.expression` 引用（空 = 默认表情）
- `assetPath` 相对 `assets/`，透明底全身立绘 PNG

## scenes.json

```json
{ "version": 2, "scenes": [ { "id": "uuid", "name": "雪域", "layers": [] } ] }
```
- `layers` 为分层场景层（底图/前景）；空时用 scene 块的 `uri` 直显图片

## 章节文件 chapters/<章节名>.json

```json
{
  "id": "uuid 或 ch-<ts>-<n>",
  "name": "序章",
  "fragments": [
    { "id": "frag-<ts>-<n> 或 uuid", "name": "main", "blocks": [ /* Block[] */ ] }
  ]
}
```
- Fragment 为可调用单元：`callFragment` 调用后**返回原流程**（类似子程序）
- `branch` 选项以 `{mode:"jump", text, fragmentId}` 跳转到具名 Fragment

## Block 结构（核心）

通用形态：`{ "id": "uuid", "type": "<类型>", "props": {…}, "content": [{ "type":"text", "text":"…", "styles":{} }] }`
- `content` 仅文本类块（dialogue/narration/comment/floatingText）携带
- `props` 内字段**几乎全是字符串**（数值也序列化为字符串）；布尔为 true/false

### 常用类型与 props

| type | 关键 props | 说明 |
|---|---|---|
| `curtain` | op(`close`/`open`), duration, color, effect | 黑场/白场 |
| `scene` | sceneId, sceneName, uri, transitionMode(`cover`), transitionDuration, displayType(`cover`), position(`(50%,50%)`), anchor(`center`) | 场景切换；uri 直显图片 |
| `particle` | mode(`show`/`hide`), preset(`LIGHT_SNOW`/`MODERATE_SNOW`), textureUri, effectId, fadeInDuration/fadeOutDuration | 粒子 |
| `camera` | offsetX, offsetY, zoom, duration, easing, targets(`scene,characters`), tweenFields, …（数十个滤镜字段可留空） | 镜头 |
| `sound` | soundType(`BGM`/`SE`/`VOICE`), uri, volume, loop, fadeDuration | 播放音频 |
| `stopSound` | soundType, fadeDuration | 停止音频 |
| `wait` | duration(ms), waitForInput | 等待 |
| `dialogue` | characterId, characterName, expression(表情名), showCharacter, keepCharacter, keepDialogue, voiceHash | 对白（有 content） |
| `narration` | keepDialogue, voiceHash | 旁白（有 content） |
| `floatingText` | position, fontSize, color, duration, animIn/Out, slideFrom… | 漂浮字（有 content） |
| `comment` | — | 编辑器注释（有 content，运行时忽略） |
| `removeCharacter` | characterId, characterName | 角色退场 |
| `callFragment` | fragmentId | 调子程序 |
| `branch` | branchId, optionsJson=`[{"mode":"jump","text":"…","fragmentId":"…"}]` | 选项分支 |
| `showExtensionUI` | target(`slot:internal.system.title`), modal, layer | 标题画面等扩展 UI |
| `returnToEntry` | — | 回入口章节（游戏结束） |
| `video` | uri, mode, waitForFinished | 视频 |
| `switchDialogueStyle` | textSpeed, charFadeIn, waitForIconDelay, extensionId | 对话风格切换 |

### 角色流规则（重要坑）
- `dialogue.props.keepCharacter: true` = 对白结束后角色**留在台上**；连续同角色对白保持 true，
  换人/转场/幕布前最后一句置 false（或显式 `removeCharacter`），否则角色**叠台不退场**。
- letsgal-ai 的 `applyCharacterFlow()` 自动处理此规则。

## assets/.manifest.json

```json
{ "version": 1, "entries": { "<内容 md5 32hex>": { "path": "se/开门.mp3", "size": 73187, "updatedAt": 1786620211729 } } }
```
- Studio 打开工程时会重新扫描资产并修正清单；新增文件需登记条目（`registerAsset`）

## 官方内置能力（无需自建）
- **导入剧本 ⌘I**：Excel 三列映射（角色/表情/对白）+ **AI 智能识别**（设置里配置 LLM Provider，
  自定义 Prompt，只发送本地文本）——适合把任意文本剧本灌进 Studio
- **Ren'Py 风格代码编辑**：与 Block 双向同步（scene/show/hide/play/pause/menu/call/jump…）
- 扩展 SDK：`@avg-studio/sdk`（运行时注入 `window.__avgRuntime.Sdk`），Vite 构建 ZIP 安装

## 无头构建（进阶）
- 官方 `build-worker.js`（app.asar 内）是纯 Node `worker_threads`：读工程 → 产出
  `web-shell` 拷贝 + `config.json` + `assets/manifest.json`（web 版）/ game-shell 桌面版
- Studio 的播放（F5）即走该管线；letsgal-ai 暂不内置构建，打开 Studio 播放即可
