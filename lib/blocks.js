// lib/blocks.js — LetsGal Studio 块构建器（Block Builders）
// 依据官方模板章节 JSON 逆向的精确 schema（props 均为字符串、content 为文本数组）。
// 文档：docs/letsgal-format.md

import crypto from 'node:crypto';

export const uid = () => crypto.randomUUID();

const block = (type, props, content) => {
  const b = { id: uid(), type };
  if (props) b.props = props;
  if (content) b.content = content;
  return b;
};

const textContent = (t) => [{ type: 'text', text: t, styles: {} }];

/** 幕布（黑场/淡入淡出） */
export const curtain = (op, { duration = '1000', color = '#000000', effect = '' } = {}) =>
  block('curtain', { disabled: false, op, effect, duration, color, mode: 'full-screen', curtainSize: '100' });

/** 场景切换（uri 直显图片；sceneId 关联 scenes.json，二选一或同传） */
export const scene = (sceneId, sceneName, uri, { transitionDuration = '500' } = {}) =>
  block('scene', {
    disabled: false, sceneId, sceneName, uri,
    transitionMode: 'cover', transitionDuration, transitionDirection: '', transitionStrips: '12',
    transitionRuleUri: '', transitionCenterX: '50', transitionCenterY: '50', transitionSoftness: '',
    transitionZoomScale: '1.14', transitionBlurStrength: '16', transitionMosaicSize: '52',
    transitionGlitchStrength: '100', transitionGlitchColorShift: '4.5', transitionGlitchScanlines: '17',
    transitionPagePerspective: '50', transitionPageShadow: '38', waitForComplete: 'false',
    resetCamera: 'false', displayType: 'cover', position: '(50%,50%)', anchor: 'center', size: '',
  });

/** 粒子（雪/樱花等，preset: LIGHT_SNOW / MODERATE_SNOW / SAKURA…） */
export const particle = (mode, { preset = 'LIGHT_SNOW', textureUri = 'particles/snow.png', effectId = uid(), fadeIn = '500', fadeOut = '500' } = {}) =>
  block('particle', { disabled: false, mode, effectId, preset, textureUri, optionsJson: '', fadeInDuration: fadeIn, fadeOutDuration: fadeOut });

/** 镜头（缩放/平移/滤镜） */
export const camera = ({ offsetX = '', offsetY = '', zoom = '', duration = '0', easing = 'easeInOut', waitForComplete = 'true', targets = 'scene,characters', tweenFields = 'offsetX,offsetY,zoom' } = {}) =>
  block('camera', {
    disabled: false, offsetX, offsetY, zoom, focalDistance: '', blurStrength: '', duration, easing,
    waitForComplete, tweenFields, targets, objectTargetsJson: '', targetSelectionPending: '',
    distortionStrength: '', vignetteIntensity: '', vignetteSize: '', blurAmount: '',
    colorToneMode: 'none', colorToneIntensity: '', colorExposure: '', colorBrightness: '',
    colorContrast: '', colorSaturation: '', colorTemperature: '', oldFilmIntensity: '',
    shockIntensity: '', godrayIntensity: '', godrayAngle: '', godrayGain: '', godrayLacunarity: '',
    godraySpeed: '', godrayParallel: '', godrayCenterX: '', godrayCenterY: '', lutPreset: '',
    lutIntensity: '', bloomIntensity: '', chromaticAberration: '', pixelateSize: '', glitchIntensity: '',
    crtIntensity: '', sharpenStrength: '', radialBlurStrength: '', radialBlurCenterX: '', radialBlurCenterY: '',
    motionBlurStrength: '', motionBlurAngle: '', zoomBlurStrength: '', zoomBlurCenterX: '', zoomBlurCenterY: '',
    lightLeakIntensity: '', lightLeakAngle: '', lensFlareIntensity: '', lensFlareCenterX: '', lensFlareCenterY: '',
    filmGrainIntensity: '', filmGrainSize: '', heatHazeIntensity: '', heatHazeSpeed: '', heatHazeScale: '',
    waterRippleIntensity: '', waterRippleFrequency: '', waterRippleSpeed: '', waterRippleCenterX: '', waterRippleCenterY: '',
    fogIntensity: '', fogSpeed: '', fogScale: '', vhsIntensity: '', vhsJitter: '', vhsNoise: '',
    halftoneIntensity: '', halftoneScale: '', halftoneAngle: '', ditherIntensity: '', ditherLevels: '',
    outlineIntensity: '', outlineThickness: '', eyelidOpenness: '', eyelidWidth: '', eyelidCurvature: '',
    eyelidSoftness: '', eyelidCenterX: '', eyelidCenterY: '', shakeAmplitude: '', shakeFrequency: '',
    shakeDuration: '', shakeFalloff: 'linear', shakeAxis: 'both',
  });

export const resetCamera = ({ duration = '800' } = {}) =>
  block('resetCamera', { disabled: false, duration });

/** BGM / SE / Voice 播放 */
export const sound = (soundType, uri, { volume = '60', loop = 'true', fadeDuration = '' } = {}) =>
  block('sound', { disabled: false, soundType, soundId: '', uri, volume, loop, fadeDuration });

export const stopSound = (soundType, { fadeDuration = '1000' } = {}) =>
  block('stopSound', { disabled: false, soundType, soundId: '', fadeDuration });

export const wait = (duration, waitForInput = false) =>
  block('wait', { disabled: false, duration, waitForInput });

/** 旁白 */
export const narration = (text, { keepDialogue = false } = {}) =>
  block('narration', { disabled: false, keepDialogue, voiceHash: '' }, textContent(text));

/** 对白（角色立绘由 characters.json 的 expressions[name] 决定） */
export const dialogue = (charId, charName, text, { expr = '', showCharacter = true, keepCharacter = true, keepDialogue = true } = {}) =>
  block('dialogue', {
    disabled: false, characterId: charId, characterName: charName, nameVariantId: '', expression: expr,
    skin: '', position: '', isFirst: true, isLast: true, prevExpression: '', prevNameVariantId: '',
    showCharacter, keepCharacter, keepDialogue, voiceHash: '',
  }, textContent(text));

/** 角色退场 */
export const removeCharacter = (charId, charName) =>
  block('removeCharacter', { disabled: false, characterId: charId, characterName: charName });

/** 编辑器注释（运行时忽略） */
export const comment = (text) =>
  block('comment', { disabled: false }, textContent(text));

/** 漂浮文字（菜单/标题/提示） */
export const floatingText = (text, { position = '(50%,50%)', anchor = 'center', fontSize = '42', color = '#ffffff', duration = '2000', inDuration = '800', outDuration = '800', slideFrom = 'top', slideDistance = '0' } = {}) =>
  block('floatingText', {
    disabled: false, position, anchor, fontSize, color, fontWeight: '', textShadow: '0 2px 8px rgba(0,0,0,0.6)',
    duration, animIn: 'fade', inDuration, animOut: 'fade', outDuration, slideFrom, slideDistance,
    scaleFrom: '1', scaleTo: '1', blurRadius: '',
  }, textContent(text));

/** 调用其它 Fragment（执行完返回） */
export const callFragment = (fragmentId) => block('callFragment', { disabled: false, fragmentId });

/** 扩展 UI（标题画面 slot:internal.system.title 等） */
export const showUI = (target, { modal = true, layer = 'topmost' } = {}) =>
  block('showExtensionUI', { disabled: false, target, modal, layer, seekBehavior: 'skip-if-seeking', size: '', position: '', interactable: '' });

/** 分支选项 */
export const branch = (branchId, options) =>
  block('branch', { disabled: false, branchId, optionsJson: JSON.stringify(options) });

/** 回到入口章节（游戏结束） */
export const returnToEntry = () => block('returnToEntry', { disabled: false });

/** 章节对象 */
export const chapter = (name) => ({ id: uid(), name, fragments: [] });

/** Fragment 对象（frag-<ts>-<n> 或任意字符串 id 均可） */
export const fragment = (chapterObj, name, id) => {
  const f = { id: id ?? `frag-${Date.now()}-${chapterObj.fragments.length + 1}`, name, blocks: [] };
  chapterObj.fragments.push(f);
  return f;
};

/**
 * 角色流后处理：同场景内角色持续在场，直到换人 / 硬边界（场景/幕布/分支/回入口）才退场。
 * 修复「角色叠台不退场」的生成问题。
 */
const BOUNDARY_TYPES = new Set(['scene', 'curtain', 'destroyScene', 'callFragment', 'branch', 'returnToEntry', 'showExtensionUI', 'removeCharacter', 'stopSound']);
export function applyCharacterFlow(chapters) {
  for (const c of chapters) {
    for (const f of c.fragments) {
      const blocks = f.blocks;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.type !== 'dialogue') continue;
        let keep = false;
        for (let j = i + 1; j < blocks.length; j++) {
          const nb = blocks[j];
          if (nb.type === 'dialogue') { keep = nb.props.characterId === b.props.characterId; break; }
          if (BOUNDARY_TYPES.has(nb.type)) break;
        }
        b.props.keepCharacter = keep;
        b.props.keepDialogue = keep;
      }
    }
  }
}
