#!/usr/bin/env node
// letsgal-ai CLI — AI 辅助 LetsGal 创作工具链
// 用法:
//   letsgal-ai init <dir> [--name 标题]
//   letsgal-ai build <story.dsl> -o <dir> [--name 标题]
//   letsgal-ai validate <dir>
//   letsgal-ai list <dir>
//   letsgal-ai mcp
import fs from 'node:fs';
import path from 'node:path';
import { initProject, validateProject } from '../lib/project.js';
import { compileStory } from '../lib/compile.js';
import { startMcpServer } from '../lib/mcp.js';

const [, , cmd, ...rest] = process.argv;
const arg = (names, def) => {
  for (let i = 0; i < rest.length - 1; i++) if (names.includes(rest[i])) return rest[i + 1];
  return def;
};
const has = (names) => rest.some((a) => names.includes(a));

const usage = () => console.log(`letsgal-ai — AI 辅助 LetsGal Studio 创作工具链

用法:
  letsgal-ai init <dir> [--name 标题]            初始化工程骨架
  letsgal-ai build <story.dsl> -o <dir> [--name 标题]   故事 DSL → 完整工程
  letsgal-ai validate <dir>                      校验工程
  letsgal-ai list <dir>                          列出章节
  letsgal-ai mcp                                 启动 MCP stdio 服务器

DSL 语法示例:
  # 序章
  !scene 雪域 backgrounds/户外雪地.png
  !bgm bgm/雪之华.mp3 vol=45
  穗(微笑): 我们还会再见的，对吧？
  旁白：时间的河流缓缓流向彼方。
  （他惊醒过来）
  !wait 800
  !choice 留下 -> fragA | 离开 -> fragB
`);

async function main() {
  if (!cmd || has(['-h', '--help', 'help'])) return usage();
  if (cmd === 'mcp') return startMcpServer();

  if (cmd === 'init') {
    const dir = rest[0];
    if (!dir) return usage();
    initProject(dir, { name: arg(['--name', '-n'], '新游戏') });
    console.log(`✅ 已初始化工程: ${path.resolve(dir)}`);
    return;
  }
  if (cmd === 'build') {
    const story = rest[0];
    const dir = arg(['-o', '--out'], null);
    if (!story || !dir) return usage();
    const dsl = fs.readFileSync(story, 'utf8');
    const r = compileStory(dsl, dir, { name: arg(['--name', '-n'], '新游戏') });
    console.log(`✅ 编译完成: ${r.chapters.length} 章 / ${r.characters.length} 角色 / ${r.scenes.length} 场景`);
    for (const c of r.chapters) console.log(`   ${c.name}: ${c.fragments.map((f) => `${f.name}(${f.blocks.length})`).join(', ')}`);
    if (r.warnings.length) { console.log('⚠️ 提示:'); for (const i of r.warnings) console.log('   - ' + i); }
    if (r.issues.length) { console.log('❌ 问题:'); for (const i of r.issues) console.log('   - ' + i); }
    return;
  }
  if (cmd === 'validate') {
    const dir = rest[0];
    if (!dir) return usage();
    const v = validateProject(dir);
    console.log(v.ok ? '✅ 工程校验通过' : '❌ 存在问题:');
    for (const i of v.issues) console.log('   - ' + i);
    process.exitCode = v.ok ? 0 : 1;
    return;
  }
  if (cmd === 'list') {
    const dir = rest[0];
    if (!dir) return usage();
    const chaptersDir = path.join(dir, 'chapters');
    if (!fs.existsSync(chaptersDir)) { console.log('（无章节）'); return; }
    for (const f of fs.readdirSync(chaptersDir).filter((x) => x.endsWith('.json')).sort()) {
      const c = JSON.parse(fs.readFileSync(path.join(chaptersDir, f), 'utf8'));
      console.log(`${c.name}: ${c.fragments.map((x) => `${x.name}(${x.blocks.length})`).join(', ')}`);
    }
    return;
  }
  usage();
}

main().catch((e) => { console.error(e); process.exit(1); });
