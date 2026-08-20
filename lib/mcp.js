// lib/mcp.js — MCP server（stdio JSON-RPC 2.0，零依赖）
// AI Agent 通过 MCP 直接调用：初始化工程 / 编译故事 / 加角色场景 / 校验
import readline from 'node:readline';
import { compileStory } from './compile.js';
import { initProject, validateProject, upsertCharacter, upsertScene, writeChapters, registerAsset } from './project.js';
import { parseStory } from './story.js';
import { chapter, fragment, narration, dialogue, curtain } from './blocks.js';
import fs from 'node:fs';
import path from 'node:path';

const PROTOCOL_VERSION = '2025-03-26';

const TOOLS = [
  {
    name: 'letsgal_init',
    description: '初始化一个 LetsGal Studio 工程骨架（project.json/characters.json/scenes.json/chapters/ 等）',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: '工程目录（绝对路径）' },
        name: { type: 'string', description: '游戏标题' },
      },
      required: ['dir'],
    },
  },
  {
    name: 'letsgal_compile',
    description: '把故事 DSL 文本编译为 LetsGal 工程章节。DSL 语法：# 章节名、## fragment名、!scene 名 uri、!bgm uri vol=45、!se uri、!curtain close、!wait 800、!particle LIGHT_SNOW particles/snow.png、!camera zoom=1.1 dur=3000、!cg uri、!choice 选项->frag | 选项2->frag、!call frag、角色(表情): 台词、旁白：文本、（舞台动作）。自动注册角色与场景。',
    inputSchema: {
      type: 'object',
      properties: {
        dsl: { type: 'string', description: '故事 DSL 文本' },
        dir: { type: 'string', description: '目标工程目录' },
        name: { type: 'string', description: '游戏标题（首次编译时生效）' },
      },
      required: ['dsl', 'dir'],
    },
  },
  {
    name: 'letsgal_add_dialogue',
    description: '向指定章节追加一条对白 Block',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string' },
        chapter: { type: 'string', description: '章节文件名（不含 .json），不存在则创建' },
        char: { type: 'string', description: '角色名' },
        text: { type: 'string', description: '台词' },
        expr: { type: 'string', description: '表情名（可选）' },
        fragment: { type: 'string', description: 'Fragment 名（默认 main）' },
      },
      required: ['dir', 'chapter', 'char', 'text'],
    },
  },
  {
    name: 'letsgal_add_narration',
    description: '向指定章节追加一条旁白 Block',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string' },
        chapter: { type: 'string' },
        text: { type: 'string' },
        fragment: { type: 'string', description: 'Fragment 名（默认 main）' },
      },
      required: ['dir', 'chapter', 'text'],
    },
  },
  {
    name: 'letsgal_validate',
    description: '校验工程结构、章节引用与资产清单完整性',
    inputSchema: {
      type: 'object',
      properties: { dir: { type: 'string' } },
      required: ['dir'],
    },
  },
  {
    name: 'letsgal_register_asset',
    description: '把 assets/ 下文件登记进 .manifest.json（供场景/音效引用）',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string' },
        rel: { type: 'string', description: '相对 assets/ 的路径，如 se/提示音.wav' },
      },
      required: ['dir', 'rel'],
    },
  },
  {
    name: 'letsgal_list_chapters',
    description: '列出工程章节与每个 Fragment 的 Block 统计',
    inputSchema: {
      type: 'object',
      properties: { dir: { type: 'string' } },
      required: ['dir'],
    },
  },
];

function callTool(name, args) {
  const { dir } = args;
  switch (name) {
    case 'letsgal_init':
      initProject(dir, { name: args.name });
      return { ok: true, dir };
    case 'letsgal_compile': {
      const r = compileStory(args.dsl, dir, { name: args.name });
      return {
        ok: r.issues.length === 0, issues: r.issues,
        chapters: r.chapters.map((c) => ({ name: c.name, fragments: c.fragments.map((f) => `${f.name}(${f.blocks.length})`) })),
        characters: r.characters.map((c) => c.name),
      };
    }
    case 'letsgal_add_dialogue': {
      const c = loadOrCreateChapter(dir, args.chapter);
      const f = getFragment(c, args.fragment || 'main');
      const chars = JSON.parse(fs.readFileSync(path.join(dir, 'characters.json'), 'utf8'));
      let ch = chars.characters.find((x) => x.name === args.char);
      if (!ch) { ch = { id: cryptoUuid(), name: args.char, expressions: [] }; chars.characters.push(ch); fs.writeFileSync(path.join(dir, 'characters.json'), JSON.stringify(chars, null, 2)); }
      f.blocks.push(dialogue(ch.id, args.char, args.text, { expr: args.expr || '' }));
      saveChapter(dir, args.chapter, c);
      return { ok: true, blockCount: f.blocks.length };
    }
    case 'letsgal_add_narration': {
      const c = loadOrCreateChapter(dir, args.chapter);
      const f = getFragment(c, args.fragment || 'main');
      f.blocks.push(narration(args.text));
      saveChapter(dir, args.chapter, c);
      return { ok: true, blockCount: f.blocks.length };
    }
    case 'letsgal_validate': {
      const v = validateProject(dir);
      return { ok: v.ok, issues: v.issues };
    }
    case 'letsgal_register_asset': {
      const h = registerAsset(dir, args.rel);
      return { ok: !!h, hash: h ?? null };
    }
    case 'letsgal_list_chapters': {
      const chaptersDir = path.join(dir, 'chapters');
      if (!fs.existsSync(chaptersDir)) return { ok: true, chapters: [] };
      const out = fs.readdirSync(chaptersDir).filter((f) => f.endsWith('.json')).map((f) => {
        const c = JSON.parse(fs.readFileSync(path.join(chaptersDir, f), 'utf8'));
        return { name: c.name, fragments: c.fragments.map((x) => ({ name: x.name, blocks: x.blocks.length })) };
      });
      return { ok: true, chapters: out };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function cryptoUuid() { return globalThis.crypto?.randomUUID?.() ?? `frag-${Date.now()}-${Math.floor(Math.random() * 1e6)}`; }
function loadOrCreateChapter(dir, name) {
  const p = path.join(dir, 'chapters', `${name}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  return chapter(name);
}
function getFragment(c, name) {
  let f = c.fragments.find((x) => x.name === name);
  if (!f) f = fragment(c, name);
  return f;
}
function saveChapter(dir, name, c) {
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'chapters', `${name}.json`), JSON.stringify(c, null, 2), 'utf8');
  // 追加到 project.json chapterOrder
  const pp = path.join(dir, 'project.json');
  if (fs.existsSync(pp)) {
    const p = JSON.parse(fs.readFileSync(pp, 'utf8'));
    if (!p.chapterOrder.includes(name)) { p.chapterOrder.push(name); p.chapterTreeOrder.push({ type: 'chapter', id: c.id }); fs.writeFileSync(pp, JSON.stringify(p, null, 2), 'utf8'); }
  }
}

/** 启动 stdio MCP server */
export function startMcpServer() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let buf = '';
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.method === 'initialize') {
      writeMsg({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'letsgal-ai', version: '0.1.0' } } });
      return;
    }
    if (msg.method === 'notifications/initialized' || msg.method === 'notifications/cancelled') return;
    if (msg.method === 'tools/list') {
      writeMsg({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS.map(({ inputSchema, ...t }) => ({ ...t, inputSchema })) } });
      return;
    }
    if (msg.method === 'tools/call') {
      try {
        const result = callTool(msg.params.name, msg.params.arguments || {});
        writeMsg({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
      } catch (e) {
        writeMsg({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(e.message || e) } });
      }
      return;
    }
    writeMsg({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  });
}

function writeMsg(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}
