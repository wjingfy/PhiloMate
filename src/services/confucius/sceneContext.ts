import type { CorpusEntry, SceneDomain } from './types';
import {
  getUserSituationScenes,
  hasScene,
  isCrossDomainScene,
} from './sceneDetect';

const SCENE_PROMPTS: Partial<Record<SceneDomain, string>> = {
  为政:
    '【为政语境】用户谈部属/居上/驭下宽严。**禁止**孝、父母、疾、孟武伯、问孝；禁丧祭「宁戚」「与其易」、绘事后素套管理。anchor 落居上、君使臣以礼、宽严得中。',
  交游:
    '【交游语境】用户谈朋友/秘密/信义/解纷。**禁止**驭下、孝、丧祭宁戚；anchor 落恕、信、推己及人、平心解纷。',
  家亲:
    '【家亲语境】用户谈父母/家庭孝养。**禁止**君使臣、驭下、部属、居上。',
  学业:
    '【学业语境】用户谈课业/读书/师命。**禁止**驭下、丧祭、孝亲套职场。',
  日用:
    '【日用语境】用户谈饮食器物/惜物取舍。**禁止**丧祭宁戚、驭下、孝亲。',
  丧祭:
    '【丧祭语境】用户谈丧哀祭祀。「与其易也宁戚」仅此时可嵌；禁套职场驭下。',
  省身:
    '【省身叠加】用户自省自责，可与主域并存。成句短接自苦/宽严，勿展开恕道说教。',
};

export function buildScenePromptBlock(
  userScenes: SceneDomain[],
  entry?: {
    id?: string;
    sceneDomains?: SceneDomain[];
    sceneExclude?: SceneDomain[];
  }
): string {
  if (userScenes.length === 0) return '';

  const situations = getUserSituationScenes(userScenes);
  const parts: string[] = [];

  for (const scene of situations) {
    const block = SCENE_PROMPTS[scene];
    if (block) parts.push(`\n${block}\n`);
  }

  if (hasScene(userScenes, '省身') && !situations.includes('省身')) {
    const block = SCENE_PROMPTS.省身;
    if (block) parts.push(`\n${block}\n`);
  }

  if (entry?.sceneExclude?.some((s) => userScenes.includes(s))) {
    parts.push(
      `\n【anchor域提示】语料 ${entry.id ?? '（本条）'} 不宜当前情境；只化用与【${userScenes.join('、')}】相容之义，禁硬摘易碎/丧祭/孝亲碎片。\n`
    );
  } else if (entry?.sceneDomains?.length && situations.length > 0) {
    const aligned = entry.sceneDomains.some(
      (s) => userScenes.includes(s) || isCrossDomainScene(s)
    );
    if (!aligned) {
      parts.push(
        `\n【anchor域提示】anchor 域【${entry.sceneDomains.join('、')}】与当前【${userScenes.join('、')}】不合；只取可迁移义，忌场景硬套。\n`
      );
    }
  }

  return parts.join('');
}

/** 为政/交游等场景下误嵌丧祭、孝亲碎片 → 剔除 */
export function fixScenePhraseLeak(text: string, userScenes: SceneDomain[]): string {
  if (userScenes.length === 0) return text;

  let t = text;
  const noMourning = !hasScene(userScenes, '丧祭');
  const noFamily = !hasScene(userScenes, '家亲');
  const workplaceOrSocial =
    hasScene(userScenes, '为政') || hasScene(userScenes, '交游');

  if (noMourning && workplaceOrSocial) {
    t = t
      .replace(/与其易也宁戚[^。；]*[。；]?/g, '')
      .replace(/礼与其易[^。；]*[。；]?/g, '')
      .replace(/宁戚[^。；]*[。；]?/g, '')
      .replace(/绘事后素[^。；]*[。；]?/g, '');
  }

  if (noFamily && hasScene(userScenes, '为政')) {
    t = t
      .replace(/父母唯[^。；]*[。；]?/g, '')
      .replace(/唯其疾[^。；]*[。；]?/g, '')
      .replace(/问孝[^。；]*[。；]?/g, '');
  }

  return t.replace(/[。；]{2,}/g, '。').replace(/^[。；]+/, '').trim() || text;
}
