import type { DialogueTurn } from './dialogueLensGuard';
import type { SceneDomain } from './types';

export type { SceneDomain };

export const CROSS_DOMAIN_SCENES: SceneDomain[] = ['省身', '通用'];

const SITUATION_SCENES: SceneDomain[] = [
  '为政',
  '家亲',
  '丧祭',
  '交游',
  '学业',
  '日用',
  '评人',
];

const WORKPLACE =
  /上司|下属|部属|成员|同事|领导|员工|职员|团队|工作|职|管理|督促|老板|偷懒|施威|宽和|压力|不留情|责任心|驭下/;
const FAMILY =
  /爸妈|父母|我妈|我爸|家里|家人|兄弟|姐妹|孝顺|令堂|令尊|问孝|家亲/;
const FAMILY_METAPHOR = /像家人|如家人|当作家人|当成家人|家人一样|家人般/;
const MOURNING = /丧|葬礼|去世|祭祀|扫墓|哀戚|临丧/;
const SOCIAL =
  /朋友|好友|闺蜜|同学|室友|同室|合租|秘密|把柄|误会|解纷|推己|信任|绝交|社交|平心|纷争|嫌隙|闹翻/;
const REAL_FAMILY_ANCHOR = /爸妈|父母|我妈|我爸|令堂|令尊|问孝|孝顺/;
const STUDY = /作业|课业|考试|老师|先生|读书|学习|复习|拖延|篇什|山田|学文|温故/;
const INTROSPECT = /反省|自省|自责|愧疚|改过|思齐|修身|内耗|纠结|自苦|觉得自己|太狠|不留情面/;
const DAILY = /吃|喝|饭|零食|过期|浪费|买东西|蛋黄酥|寄来|舍不得扔|弃物|惜物|食物/;
const EXEMPLAR = /孔子怎么看|子产|颜回|子路|子贡|冉雍|那人算不算|孰贤/;

function pickSituationScenes(text: string): SceneDomain[] {
  const found: SceneDomain[] = [];
  if (WORKPLACE.test(text)) found.push('为政');
  // 室友/朋友「像家人」→ 交游，勿标家亲（否则易误命中孝弟为仁之本）
  const roommateOrFriend = /室友|同室|合租|朋友|好友|闺蜜|同学/.test(text);
  const familyOk =
    FAMILY.test(text) &&
    !FAMILY_METAPHOR.test(text) &&
    !(roommateOrFriend && !REAL_FAMILY_ANCHOR.test(text));
  if (familyOk || REAL_FAMILY_ANCHOR.test(text)) found.push('家亲');
  if (MOURNING.test(text)) found.push('丧祭');
  if (SOCIAL.test(text)) found.push('交游');
  if (STUDY.test(text)) found.push('学业');
  if (DAILY.test(text)) found.push('日用');
  if (EXEMPLAR.test(text)) found.push('评人');
  return [...new Set(found)];
}

function pickCrossDomainScenes(text: string): SceneDomain[] {
  const found: SceneDomain[] = [];
  if (INTROSPECT.test(text)) found.push('省身');
  return found;
}

/** 仅检当轮输入 */
export function detectCurrentScenes(userInput: string): SceneDomain[] {
  return [
    ...new Set([...pickSituationScenes(userInput), ...pickCrossDomainScenes(userInput)]),
  ];
}

/**
 * 对话流程用：当轮主域优先，续论沿用 activeScenes；交游轮可覆盖为政。
 */
export function resolveUserScenes(
  userInput: string,
  priorTurns: DialogueTurn[] = [],
  activeScenes: SceneDomain[] = []
): SceneDomain[] {
  const current = detectCurrentScenes(userInput);
  const currentSituations = getUserSituationScenes(current);
  const currentCross = current.filter(isCrossDomainScene);

  let situations: SceneDomain[];

  if (currentSituations.length > 0) {
    if (currentSituations.includes('交游') && !currentSituations.includes('为政')) {
      situations = currentSituations.filter((s) => s !== '为政');
    } else {
      situations = currentSituations;
    }
  } else {
    situations = getUserSituationScenes(activeScenes);
    if (situations.length === 0 && priorTurns.length > 0) {
      const recent = priorTurns
        .slice(-4)
        .map((t) => t.content)
        .join('');
      situations = pickSituationScenes(recent);
    }
  }

  const priorCross = activeScenes.filter(isCrossDomainScene);
  const cross = currentCross.length > 0 ? currentCross : priorCross;

  return [...new Set([...situations, ...cross])].slice(-6);
}

/** @deprecated 用 resolveUserScenes；保留供检索单轮回退 */
export function detectUserScenes(userInput: string, priorTurns: DialogueTurn[] = []): SceneDomain[] {
  return resolveUserScenes(userInput, priorTurns, []);
}

export function hasScene(scenes: SceneDomain[], scene: SceneDomain): boolean {
  return scenes.includes(scene);
}

export function isCrossDomainScene(scene: SceneDomain): boolean {
  return CROSS_DOMAIN_SCENES.includes(scene);
}

export function getUserSituationScenes(scenes: SceneDomain[]): SceneDomain[] {
  return scenes.filter((s) => SITUATION_SCENES.includes(s));
}

export function getPrimarySituationScene(scenes: SceneDomain[]): SceneDomain | null {
  const situations = getUserSituationScenes(scenes);
  return situations[0] ?? null;
}
