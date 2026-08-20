// lib/project.js — LetsGal 工程读写（project.json / characters.json / scenes.json / chapters/*.json / assets/.manifest.json）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { uid } from './blocks.js';

/** 默认 project.json（对齐官方新建工程 ground truth） */
export function defaultProject(name) {
  return {
    id: uid(),
    version: '1.0.0',
    engineVersion: '1.0.0',
    name,
    resolution: { width: 1920, height: 1080 },
    backgroundColor: '#000000',
    window: { lockAspectRatio: false, allowMaximize: true, allowFullscreen: true, launchMode: 'windowed' },
    cursor: {
      mode: 'system', image: '', imagePixelRatio: 1,
      imageSize: { width: 24, height: 24 }, hotspot: { x: 0, y: 0 },
      fallback: 'default', css: '', cssImagePixelRatio: 1,
      cssImageSize: { width: 24, height: 24 },
    },
    chapterOrder: [],
    chapterFolders: [],
    chapterTreeOrder: [],
    extensionStorageVersion: 1,
    extensions: {},
    extensionSettings: {},
    dataBindings: {},
    dynamicVisualAssets: [],
  };
}

export const emptyCharacters = () => ({ version: 2, globalSettings: {}, attributeTemplate: [], characters: [] });
export const emptyScenes = () => ({ version: 2, scenes: [] });
export const emptyManifest = () => ({ version: 1, entries: {} });

/** 初始化空工程骨架 */
export function initProject(dir, { name = '新游戏', overwrite = false } = {}) {
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  const write = (rel, obj) => {
    const p = path.join(dir, rel);
    if (fs.existsSync(p) && !overwrite) return false;
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  };
  write('project.json', defaultProject(name));
  write('characters.json', emptyCharacters());
  write('scenes.json', emptyScenes());
  write(path.join('assets', '.manifest.json'), emptyManifest());
  return dir;
}

/** 写章节文件 + 同步 project.json 的 chapterOrder/chapterTreeOrder */
export function writeChapters(dir, chapters, { name } = {}) {
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  for (const c of chapters) {
    fs.writeFileSync(path.join(dir, 'chapters', `${c.name}.json`), JSON.stringify(c, null, 2), 'utf8');
  }
  // 更新 project.json
  const pp = path.join(dir, 'project.json');
  const project = fs.existsSync(pp) ? JSON.parse(fs.readFileSync(pp, 'utf8')) : defaultProject(name ?? '新游戏');
  project.name = name ?? project.name;
  project.chapterOrder = chapters.map((c) => c.name);
  project.chapterTreeOrder = chapters.map((c) => ({ type: 'chapter', id: c.id }));
  fs.writeFileSync(pp, JSON.stringify(project, null, 2), 'utf8');
}

/** 注册角色（不存在则追加）；expressions: [{name, assetPath}] */
export function upsertCharacter(dir, { id = uid(), name, expressions = [] }) {
  const p = path.join(dir, 'characters.json');
  const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : emptyCharacters();
  const existing = data.characters.find((c) => c.name === name);
  if (existing) { existing.expressions = expressions.length ? expressions : existing.expressions; return existing.id; }
  data.characters.push({ id, name, expressions });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  return id;
}

/** 注册场景（不存在则追加） */
export function upsertScene(dir, { id = uid(), name, layers = [] }) {
  const p = path.join(dir, 'scenes.json');
  const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : emptyScenes();
  if (!data.scenes.find((s) => s.name === name)) {
    data.scenes.push({ id, name, layers });
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  }
}

/** 校验工程：结构性问题=issues（ok:false）；资产未登记等=warnings（ok 仍为 true，素材可稍后补充） */
export function validateProject(dir) {
  const issues = [];
  const warnings = [];
  const must = ['project.json', 'characters.json', 'scenes.json', 'assets/.manifest.json'];
  for (const rel of must) {
    if (!fs.existsSync(path.join(dir, rel))) issues.push(`missing ${rel}`);
  }
  if (!fs.existsSync(path.join(dir, 'chapters'))) issues.push('missing chapters/');
  if (fs.existsSync(path.join(dir, 'project.json'))) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
    if (!Array.isArray(p.chapterOrder)) issues.push('project.json: chapterOrder 缺失');
    for (const chName of p.chapterOrder) {
      const f = path.join(dir, 'chapters', `${chName}.json`);
      if (!fs.existsSync(f)) issues.push(`章节文件缺失: chapters/${chName}.json`);
    }
  }
  // 章节内引用检查：dialogue.characterId / scene.uri 资产存在性
  const manifest = fs.existsSync(path.join(dir, 'assets/.manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(dir, 'assets/.manifest.json'), 'utf8'))
    : { entries: {} };
  const assetPaths = new Set(Object.values(manifest.entries || {}).map((e) => e.path));
  const chaptersDir = path.join(dir, 'chapters');
  if (fs.existsSync(chaptersDir)) {
    for (const f of fs.readdirSync(chaptersDir)) {
      if (!f.endsWith('.json')) continue;
      const c = JSON.parse(fs.readFileSync(path.join(chaptersDir, f), 'utf8'));
      for (const fr of c.fragments || []) {
        for (const b of fr.blocks || []) {
          const p = b.props || {};
          if ((b.type === 'scene' || b.type === 'sound') && p.uri && !assetPaths.has(p.uri)) {
            warnings.push(`${f}/${fr.name}: 资产未在清单中: ${p.uri}（可在 Studio 素材库导入）`);
          }
        }
      }
    }
  }
  return { ok: issues.length === 0, issues, warnings };
}

/** 追加/更新 assets/.manifest.json 条目（path/size/updatedAt，键为内容 md5） */
export function registerAsset(dir, relPath) {
  const abs = path.join(dir, 'assets', relPath);
  if (!fs.existsSync(abs)) return null;
  const bytes = fs.readFileSync(abs);
  const hash = crypto.createHash('md5').update(bytes).digest('hex');
  const p = path.join(dir, 'assets', '.manifest.json');
  const mf = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : emptyManifest();
  // 删除同 path 旧条目
  for (const [k, v] of Object.entries(mf.entries)) if (v.path === relPath) delete mf.entries[k];
  mf.entries[hash] = { path: relPath, size: bytes.length, updatedAt: Date.now() };
  fs.writeFileSync(p, JSON.stringify(mf, null, 2), 'utf8');
  return hash;
}
