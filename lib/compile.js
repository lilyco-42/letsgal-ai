// lib/compile.js — 编排：故事 DSL → 完整 LetsGal 工程
import fs from 'node:fs';
import path from 'node:path';
import { parseStory } from './story.js';
import { initProject, writeChapters, upsertCharacter, upsertScene, validateProject } from './project.js';

/**
 * 把故事 DSL 编译为 LetsGal 工程。
 * @param {string} dsl 故事文本
 * @param {string} dir 输出工程目录
 * @param {{name?:string, init?:boolean}} opts init=true 时先建骨架
 * @returns {{chapters:Array, characters:Array, scenes:Array, issues:string[]}}
 */
export function compileStory(dsl, dir, { name, init = true } = {}) {
  if (init) initProject(dir, { name });
  const { chapters, characters, scenes } = parseStory(dsl);

  for (const c of characters.values()) upsertCharacter(dir, c);
  for (const s of scenes.values()) upsertScene(dir, s);

  writeChapters(dir, chapters, { name });

  const v = validateProject(dir);
  return { chapters, characters: [...characters.values()], scenes: [...scenes.values()], issues: v.issues, warnings: v.warnings };
}
