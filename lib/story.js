// lib/story.js — 故事 DSL 解析器
// 面向 AI 的纯文本剧本格式 → LetsGal 章节 Block。
// 规范见 docs/STORY-DSL.md
import crypto from 'node:crypto';
import {
  chapter as makeChapter, fragment as makeFragment, applyCharacterFlow,
  curtain, scene, particle, camera, resetCamera, sound, stopSound, wait,
  narration, dialogue, comment, floatingText, callFragment, showUI, branch, returnToEntry, uid,
} from './blocks.js';

/** 由名称生成稳定 UUID（重编译不漂移） */
export function stableId(namespace, name) {
  const h = crypto.createHash('md5').update(`${namespace}:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const CHAR_NS = 'letsgal-ai:character';
const SCENE_NS = 'letsgal-ai:scene';

function parseKV(s) {
  // "name:文本 或 角色(表情):文本" → { char, expr, text }
  const m = s.match(/^(.+?)\s*[:：]\s*(.+)$/s);
  if (!m) return null;
  const head = m[1].trim();
  const text = m[2].trim();
  if (head === '旁白' || head === '心理' || head === 'n' || head === 'narration') {
    return { kind: 'narration', text };
  }
  const cm = head.match(/^(.+?)[（(](.+?)[)）]$/);
  if (cm) return { kind: 'dialogue', char: cm[1].trim(), expr: cm[2].trim(), text };
  return { kind: 'dialogue', char: head, expr: '', text };
}

/**
 * 解析故事 DSL 文本。
 * @returns {{chapters:Array, characters:Map<string,{id,name,expressions:[]}>, scenes:Map<string,{id,name}>}}
 */
export function parseStory(text) {
  const chapters = [];
  const characters = new Map();
  const scenes = new Map();
  let cur = null;      // 当前章节
  let frag = null;     // 当前 fragment
  let fragByName = new Map(); // name -> fragment（暂存，用于 choice/call 二次解析）

  const ensureFrag = () => { if (!frag) frag = makeFragment(cur, 'main'); };

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    if (line.startsWith('## ')) {
      // 新 fragment（具名）
      frag = makeFragment(cur, line.slice(3).trim());
      continue;
    }
    if (line.startsWith('#')) {
      cur = makeChapter(line.slice(1).trim());
      chapters.push(cur);
      frag = makeFragment(cur, 'main');
      continue;
    }
    if (!cur) { cur = makeChapter('序章'); chapters.push(cur); frag = makeFragment(cur, 'main'); }

    if (line.startsWith('!')) {
      const rest = line.slice(1).trim();
      const [cmd, ...args] = rest.split(/\s+/);
      const kv = {};
      const pos = []; // 位置参数（uri 等）
      const FLAGS = new Set(['loop']);
      for (const a of args) {
        const eq = a.indexOf('=');
        if (eq > 0) kv[a.slice(0, eq)] = a.slice(eq + 1);
        else if (FLAGS.has(a)) kv[a] = 'true';
        else pos.push(a);
      }
      const arg = pos.join(' ');
      ensureFrag();
      switch (cmd) {
        case 'curtain': frag.blocks.push(curtain(arg || 'close', { duration: kv.dur || kv.duration || '1000' })); break;
        case 'scene': {
          const [sname, suri] = arg.split(/\s+/);
          const sid = stableId(SCENE_NS, sname);
          scenes.set(sname, { id: sid, name: sname });
          frag.blocks.push(scene(sid, sname, suri || '', { transitionDuration: kv.td || kv.transition || '500' }));
          break;
        }
        case 'cg': {
          const [sname, suri] = arg.split(/\s+/);
          const sid = stableId(SCENE_NS, sname);
          scenes.set(sname, { id: sid, name: sname });
          frag.blocks.push(scene(sid, sname, suri || '', { transitionDuration: kv.td || '800' }));
          break;
        }
        case 'bgm': frag.blocks.push(sound('BGM', arg, { volume: kv.vol || '45', loop: kv.loop !== 'false', fadeDuration: kv.fade || '' })); break;
        case 'se': frag.blocks.push(sound('SE', arg, { volume: kv.vol || '60', loop: kv.loop === 'true', fadeDuration: kv.fade || '' })); break;
        case 'voice': frag.blocks.push(sound('VOICE', arg, { volume: kv.vol || '80', loop: 'false' })); break;
        case 'stopbgm': frag.blocks.push(stopSound('BGM', { fadeDuration: kv.fade || '1000' })); break;
        case 'stopse': frag.blocks.push(stopSound('SE', { fadeDuration: kv.fade || '500' })); break;
        case 'particle': {
          const [preset, puri] = arg.split(/\s+/);
          frag.blocks.push(particle(kv.mode || 'show', { preset: preset || 'LIGHT_SNOW', textureUri: puri || 'particles/snow.png', fadeIn: kv.fadeIn || '500', fadeOut: kv.fadeOut || '500' }));
          break;
        }
        case 'camera': frag.blocks.push(camera({ offsetX: kv.offsetX || '', offsetY: kv.offsetY || '', zoom: kv.zoom || '', duration: kv.dur || kv.duration || '0', easing: kv.easing || 'easeInOut', targets: kv.targets || 'scene,characters' })); break;
        case 'resetcamera': frag.blocks.push(resetCamera({ duration: kv.dur || '800' })); break;
        case 'wait': frag.blocks.push(wait(kv.input === 'true' ? 0 : parseInt(arg || '800', 10) || 800, kv.input === 'true')); break;
        case 'float': frag.blocks.push(floatingText(arg, { fontSize: kv.size || '42', duration: kv.dur || '2000' })); break;
        case 'comment': frag.blocks.push(comment(arg)); break;
        case 'title': frag.blocks.push(showUI('slot:internal.system.title')); break;
        case 'end': frag.blocks.push(returnToEntry()); break;
        case 'call': frag.blocks.push(callFragment(kv.id || arg)); break;
        case 'choice': {
          const opts = arg.split('|').map((o) => {
            const [t, target] = o.trim().split(/\s*->\s*/);
            return { mode: 'jump', text: t.trim(), fragmentId: target.trim() };
          });
          frag.blocks.push(branch(uid(), opts));
          break;
        }
        default: frag.blocks.push(comment(`[未知指令 ${cmd}] ${arg}`));
      }
      continue;
    }

    // 文本行：对白 / 旁白 / 舞台说明
    ensureFrag();
    if (line.startsWith('（') || line.startsWith('(')) {
      frag.blocks.push(narration(line));
      continue;
    }
    const p = parseKV(line);
    if (!p) { frag.blocks.push(narration(line)); continue; }
    if (p.kind === 'narration') {
      frag.blocks.push(narration(p.text));
    } else {
      if (!characters.has(p.char)) characters.set(p.char, { id: stableId(CHAR_NS, p.char), name: p.char, expressions: [] });
      frag.blocks.push(dialogue(characters.get(p.char).id, p.char, p.text, { expr: p.expr }));
    }
  }

  // 二次解析：choice/call 的 fragmentId 若为名称，替换为对应 fragment id
  for (const c of chapters) {
    for (const f of c.fragments) {
      for (const b of f.blocks) {
        if (b.type === 'branch') {
          const opts = JSON.parse(b.props.optionsJson);
          for (const o of opts) {
            if (!o.fragmentId.startsWith('frag-')) {
              const t = findFragmentId(chapters, o.fragmentId);
              if (t) o.fragmentId = t;
            }
          }
          b.props.optionsJson = JSON.stringify(opts);
        }
        if (b.type === 'callFragment' && !b.props.fragmentId.startsWith('frag-')) {
          const t = findFragmentId(chapters, b.props.fragmentId);
          if (t) b.props.fragmentId = t;
        }
      }
    }
  }

  applyCharacterFlow(chapters);
  return { chapters, characters, scenes };
}

function findFragmentId(chapters, name) {
  for (const c of chapters) for (const f of c.fragments) if (f.name === name) return f.id;
  return null;
}
