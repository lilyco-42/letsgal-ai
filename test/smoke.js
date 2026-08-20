// 冒烟测试：init → build → validate → MCP 握手（无外部依赖）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'letsgal-ai.js');
const dslPath = path.join(ROOT, 'examples', 'example.dsl');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'letsgal-smoke-'));

const run = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (err += d));
  p.on('close', (code) => resolve({ code, out, err }));
});

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
};

console.log('--- CLI init ---');
let r = await run(['init', dir, '--name', '冒烟测试']);
check('init exit 0', r.code === 0, r.err);
check('project.json 生成', fs.existsSync(path.join(dir, 'project.json')));

console.log('--- CLI build ---');
r = await run(['build', dslPath, '-o', dir, '--name', '冒烟测试']);
check('build exit 0', r.code === 0, r.err + r.out.slice(0, 300));
const chaptersDir = path.join(dir, 'chapters');
const files = fs.existsSync(chaptersDir) ? fs.readdirSync(chaptersDir) : [];
check('章节生成 (4)', files.length === 4, JSON.stringify(files));
check('角色注册', fs.existsSync(path.join(dir, 'characters.json')));

console.log('--- CLI validate ---');
r = await run(['validate', dir]);
check('validate exit 0', r.code === 0, r.out);

console.log('--- 章节内容抽查 ---');
const prologue = JSON.parse(fs.readFileSync(path.join(chaptersDir, files.find((f) => f.includes('序章'))), 'utf8'));
const main = prologue.fragments[0];
const dlg = main.blocks.filter((b) => b.type === 'dialogue');
check('序章有对白', dlg.length >= 2);
check('对白 schema (props.characterId)', dlg.every((d) => d.props.characterId && d.content?.[0]?.text));
const lastDlg = dlg[dlg.length - 1];
check('角色流: 末句退场', lastDlg.props.keepCharacter === false, JSON.stringify(dlg.map((d) => d.props.keepCharacter)));

console.log('--- 终章分支 ---');
const finale = JSON.parse(fs.readFileSync(path.join(chaptersDir, files.find((f) => f.includes('终章'))), 'utf8'));
const br = finale.fragments[0].blocks.find((b) => b.type === 'branch');
check('分支存在', !!br);
if (br) {
  const opts = JSON.parse(br.props.optionsJson);
  check('分支目标解析为 frag id', opts.length === 2 && opts.every((o) => o.fragmentId.startsWith('frag-')));
}

console.log('--- MCP 握手 ---');
const mcp = spawn(process.execPath, [CLI, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '';
const waitMsg = (pred, timeout = 5000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    const lines = buf.split('\n');
    for (const l of lines) { if (!l) continue; try { const m = JSON.parse(l); if (pred(m)) { clearInterval(iv); resolve(m); return; } } catch {} }
    if (Date.now() - t0 > timeout) { clearInterval(iv); reject(new Error('timeout')); }
  }, 20);
});
mcp.stdout.on('data', (d) => (buf += d.toString()));
const send = (o) => mcp.stdin.write(JSON.stringify(o) + '\n');

try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
  const init = await waitMsg((m) => m.id === 1);
  check('initialize 返回 capabilities', !!init.result?.capabilities?.tools);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tl = await waitMsg((m) => m.id === 2);
  check('tools/list 有 7 个工具', tl.result?.tools?.length === 7, `got ${tl.result?.tools?.length}`);
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'letsgal_validate', arguments: { dir } } });
  const tc = await waitMsg((m) => m.id === 3);
  const parsed = JSON.parse(tc.result.content[0].text);
  check('tools/call validate ok', parsed.ok === true, JSON.stringify(parsed));} catch (e) {
  check('MCP 握手', false, String(e));
} finally {
  mcp.kill();
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
