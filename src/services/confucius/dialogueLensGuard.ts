import type { LensExtractResult, UserLens } from './types';
import { hasScene, type SceneDomain } from './sceneDetect';
import { isPraiseInput } from './praiseLensGuard';

export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
}

const WORKPLACE = /上司|下属|成员|同事|领导|员工|职员|团队|工作|职|管理|督促|老板/;
const WORKPLACE_MANAGE =
  /下属|管理|偷懒|施威|宽和|压力|不留情|宽严|给人压力|太不留情/;
/** 反驳：仅 API/turnFocus 失败时的极薄 fallback（主路径靠模型 speechAct） */
const REBUTTAL = /但|然而|不对|并非|没关系|并无|非是|岂|你刚才|你说|错了|跟.*无关|与.*无关/;
const META_CRITIQUE =
  /是否.*(未|不).*(中道|得)|未得中道|你如此批评|如此批评我|批评我|你也.*(未|不|偏|失)|夫子.*是否.*(中|偏|失)|质疑.*(中|偏)|对话.*(偏|失)/;
const SCOPE_CLARIFY =
  /真正热爱|热爱的事|无可指摘|我会.*努力|指的是|并非.*(起床|作息|十时)|只在.*(热爱|事业)/;
const NEGATE_XIAOTI =
  /跟.*(孝|悌|弟).*没|与.*(孝|悌|弟).*无|和.*(孝|悌|弟).*没|非.*(孝|悌|弟)|不.*(孝|悌|弟)|没关系.*(孝|悌|弟)|(孝|悌|弟).*没关系/;

/**
 * 用户在同一话题内收窄/追问边界或定义（非换题、非纯反驳）
 * 例：何为正直？何种程度才算？怎样的恶才能用公器？
 */
const QUESTION_REFINEMENT =
  /何为|何谓|什么叫|何谓.*\?|怎样才算|何种|到什么程度|到何种程度|究竟怎样|到底.*(才|算|配)|怎样的.*(才能|才算|才配|才可)|什么样的.*(才能|才算)|那到底|那究竟|但又何为|才算值得|才能用公|才配用|究竟.*(恶|直|怨|礼|仁)/;

/** 核对主张：仅 fallback；主路径靠 turnFocus.speechAct=consistency */
const CONSISTENCY_CHALLENGE =
  /之前也说过|刚才.*(说|讲)|你说过|夫子之前|夫子.*(也)?说过|但夫子|你也说过|不是说|明明说|「[^」]{4,}」|“[^”]{4,}”/;

/** 用户从案情/公器辩转谈自身为人（须跟新问旨） */
const SELF_CULTIVATION_SHIFT =
  /我自己|我平时|无愧于|不愧对|良心|别人的评价|评价都是次要|做事也是|我为人|我的原则/;

const LEGAL_CASE_STICK =
  /报警|报官|有司|公器|诽谤|谤|非议|诉诸|律法|刑书|网暴|犯法|证据/;

/** 软话题簇：仅粗域切换兜底（法律/职场/健身等）；饮食内换侧面改由 turnFocus.relation */
export type SoftTopicCluster =
  | 'food'
  | 'fitness'
  | 'legal_gov'
  | 'workplace'
  | 'conscience'
  | 'sleep'
  | null;

export function inferSoftTopicCluster(text: string): SoftTopicCluster {
  const t = text || '';
  if (!t.trim()) return null;
  if (/报警|公器|有司|诽谤|律法|网暴|刑书/.test(t)) return 'legal_gov';
  if (/无愧于|不愧对|良心|评价都是次要/.test(t)) return 'conscience';
  if (/上司|下属|部属|职场|管理|督促|偷懒|施威/.test(t)) return 'workplace';
  if (/起床|作息|十时|晨兴|十点钟/.test(t)) return 'sleep';
  if (/健身|耐力|跑步|锻炼|训练|有氧/.test(t)) return 'fitness';
  // 饮食大类合并；豆浆粉↔脍细 等侧面差不靠此簇，靠 turnFocus.relation
  if (
    /豆浆|麦片|燕麦|咖啡|荤素|蛋白质|蔬菜|吃肉|脍|切片|熟透|饮食|泡面|蛋黄酥/.test(t)
  ) {
    return 'food';
  }
  return null;
}

export interface StickyReleaseContext {
  openQuestion?: string | null;
  lastUserMessage?: string | null;
  lastAssistantMessage?: string | null;
  lastUserCondensed?: string | null;
  /** 本轮 turnFocus.relation；有则优先，follow 启发式仅作无 relation 时兜底 */
  turnRelation?: 'same_focus' | 'follow_cue' | 'shift' | null;
}

/** 粗域切换兜底（如食物↔公器）；饮食内部换侧面请用 turnFocus.relation */
export function isSoftTopicShiftTurn(text: string, ctx?: StickyReleaseContext): boolean {
  const cur = inferSoftTopicCluster(text);
  if (!cur) return false;
  const prevBlob = `${ctx?.openQuestion || ''}\n${ctx?.lastUserMessage || ''}\n${ctx?.lastUserCondensed || ''}`;
  const prev = inferSoftTopicCluster(prevBlob);
  if (!prev) return false;
  return cur !== prev;
}

/**
 * 主路径改用 turnFocus.relation===follow_cue；此函数仅 API 失败 / 无 relation 时 fallback
 */
export function isFollowAssistantCueTurn(text: string, ctx?: StickyReleaseContext): boolean {
  const last = (ctx?.lastAssistantMessage || '').trim();
  const t = (text || '').trim();
  if (!last || !t || t.length < 4) return false;
  const anchors = last.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  const prevUser = `${ctx?.openQuestion || ''}${ctx?.lastUserMessage || ''}${ctx?.lastUserCondensed || ''}`;
  for (const a of anchors) {
    if (/以为|亦可|然则|虽非|固|盖/.test(a)) continue;
    if (t.includes(a) && !prevUser.includes(a)) return true;
  }
  return false;
}

/**
 * 用户明确发问（含 A 还是 B / 怎么看），须正面作答。
 */
export function isDirectQuestionTurn(text: string): boolean {
  const t = (text || '').trim();
  if (!t || t.length < 8) return false;
  if (META_CRITIQUE.test(t)) return false;
  if (QUESTION_REFINEMENT.test(t) && t.length <= 120) return true;
  if (/.{2,}(?:还是|抑或).{2,}/.test(t) && /认为|觉得|属于|算|是|夫子|孔子|你/.test(t)) {
    return true;
  }
  if (
    /夫子认为|孔子认为|你认为|你觉得|丘以为|夫子怎么看|你怎么看|孔子怎么看/.test(t)
  ) {
    return true;
  }
  if (/[？?]\s*$/.test(t) && /属于|还是|是否|算不算|未善|所长|怎么看|偏好/.test(t)) {
    return true;
  }
  return false;
}

export function isMetaCritiqueTurn(text: string): boolean {
  return META_CRITIQUE.test(text);
}

export function isScopeClarificationTurn(text: string): boolean {
  return SCOPE_CLARIFY.test(text);
}

/** 收窄追问：须放开 lens sticky，并以本轮问旨为 openQuestion */
export function isQuestionRefinementTurn(text: string): boolean {
  const t = (text || '').trim();
  if (!t || t.length > 120) return false;
  if (isMetaCritiqueTurn(t)) return false;
  return QUESTION_REFINEMENT.test(t);
}

/** 核对先前主张：须承认或辨析边界，禁止直接改口 */
export function isConsistencyChallengeTurn(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return CONSISTENCY_CHALLENGE.test(t);
}

/** 话题转到自修/良心：放开旧案 sticky，勿再扯有司 */
export function isSelfCultivationShiftTurn(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (!SELF_CULTIVATION_SHIFT.test(t)) return false;
  if (LEGAL_CASE_STICK.test(t) && !/无愧于|良心|评价都是次要|我自己平时/.test(t)) {
    return false;
  }
  return true;
}

/** 须释放 sticky / 刷新 openQuestion 的轮次 */
export function shouldReleaseDialogueSticky(text: string, ctx?: StickyReleaseContext): boolean {
  if (ctx?.turnRelation === 'follow_cue' || ctx?.turnRelation === 'shift') return true;
  // 夸赞（尤其夸上轮回答）= 议题转到评价对话本身，勿粘旧 lens
  if (isPraiseInput(text)) return true;
  return (
    isQuestionRefinementTurn(text) ||
    isDirectQuestionTurn(text) ||
    isMetaCritiqueTurn(text) ||
    isConsistencyChallengeTurn(text) ||
    isDebateTurn(text) ||
    isSelfCultivationShiftTurn(text) ||
    isSoftTopicShiftTurn(text, ctx) ||
    // 无 turnFocus 时才用启发式跟点
    (!ctx?.turnRelation && isFollowAssistantCueTurn(text, ctx))
  );
}

export function formatDialogueSnippet(turns: DialogueTurn[], max = 4): string {
  if (turns.length === 0) return '';
  return turns
    .slice(-max)
    .map((t) => `${t.role === 'user' ? '用户' : '孔子'}：${t.content}`)
    .join('\n');
}

export function isRebuttalTurn(text: string): boolean {
  return REBUTTAL.test(text) || isMetaCritiqueTurn(text);
}

/**
 * @deprecated 主路径用 turnFocus.speechAct；仅 fallback
 */
export function isDebateTurn(text: string): boolean {
  return isRebuttalTurn(text) || isConsistencyChallengeTurn(text);
}

export function findPriorUserThemeQuestion(turns: DialogueTurn[]): string | undefined {
  const users = turns.filter((t) => t.role === 'user');
  if (users.length === 0) return undefined;
  return users[users.length - 1]?.content;
}

/** 职场语境不得套孝悌；用户在反驳孝悌时续论原题（仁/礼） */
export function applyDialogueLensGuard(
  userInput: string,
  extract: LensExtractResult,
  priorTurns: DialogueTurn[],
  userScenes: SceneDomain[] = []
): LensExtractResult {
  const text = userInput;
  const workplace =
    hasScene(userScenes, '为政') ||
    WORKPLACE.test(text) ||
    priorTurns.some((t) => WORKPLACE.test(t.content));
  const social = hasScene(userScenes, '交游');
  const rebuttal = isRebuttalTurn(text);
  const metaCritique = isMetaCritiqueTurn(text);
  const negatesXiaoTi = NEGATE_XIAOTI.test(text);

  if (metaCritique) {
    extract.path = 'path1';
    extract.lenses = [
      {
        kind: 'category',
        key: '过度/不及/适度',
        reinterpretation: '自省求中未至极',
        mentionReason: '用户质疑孔子发言是否失中',
      },
    ];
    extract.primaryLensIndex = 0;
    extract.condensed = '质疑夫子批评是否亦失中道';
    return extract;
  }

  if (workplace) {
    const bad = new Set(['孝', '悌']);
    const idx = extract.primaryLensIndex ?? 0;
    const primary = extract.lenses[idx];
    if (primary && bad.has(primary.key)) {
      extract.lenses[idx] = {
        kind: 'theme',
        key: /仁|德/.test(text + priorTurns.map((t) => t.content).join('')) ? '仁' : '礼',
        reinterpretation: workplace && /仁|德/.test(text) ? '责众而问仁' : '上下有分在礼',
        mentionReason: '职场上下→礼/仁，非孝悌',
      };
      extract.path = 'path1';
    } else if (WORKPLACE_MANAGE.test(text)) {
      extract.path = 'path1';
      extract.lenses[idx] = {
        kind: 'theme',
        key: '礼',
        reinterpretation: /不留情|施威|压力|太|宽和|偷懒/.test(text)
          ? '居上宜宽严得中'
          : '君使臣以礼',
        mentionReason: '职场管理→礼，禁套孝/父母语料',
      };
      extract.condensed = '居上驭下宜宽严得中';
    }
  }

  if (social && !workplace) {
    const idx = extract.primaryLensIndex ?? 0;
    const primary = extract.lenses[idx];
    const roommate =
      /室友|同室|合租|闹翻|嫌隙/.test(text) ||
      priorTurns.some((t) => /室友|同室|合租/.test(t.content));
    if (primary && (primary.key === '孝' || primary.key === '悌')) {
      extract.lenses[idx] = {
        kind: 'theme',
        key: roommate || /仁|何为仁/.test(text) ? '仁' : '恕',
        reinterpretation: /解纷|误会|秘密|推己/.test(text)
          ? '平心解纷在恕'
          : roommate
            ? '友朋相待之仁非孝悌'
            : '友信在恕',
        mentionReason: '交游语境→仁/恕，非孝悌',
      };
      extract.path = 'path1';
    }
  }

  if (rebuttal && negatesXiaoTi) {
    const priorBlob = priorTurns.map((t) => t.content).join('');
    const key = /仁|德/.test(priorBlob + text) ? '仁' : '礼';
    extract.path = 'path1';
    extract.lenses = [
      {
        kind: 'theme',
        key,
        reinterpretation: key === '仁' ? '责而不失仁' : '上下分在礼',
        mentionReason: '驳孝悌套用，续论原旨',
      },
    ];
    extract.primaryLensIndex = 0;
    extract.condensed = extract.condensed || '辩上下与孝悌之别';
  }

  // 无愧于心 / 良心 → 省察（theme「诚」当前无语料，不可匹配；禁信/輗軏）
  if (isSelfCultivationShiftTurn(text) || /无愧于|不愧对|良心|对得起自己/.test(text)) {
    extract.path = 'path1';
    extract.lenses = [
      {
        kind: 'theme',
        key: '省察',
        reinterpretation: '无愧于心以自省立诚',
        mentionReason: '自修良心→省察（诚无语料不可匹配），非对人之信',
      },
      ...extract.lenses.filter((l) => l.key !== '信' && l.key !== '诚' && l.key !== '省察'),
    ];
    extract.primaryLensIndex = 0;
    extract.condensed = extract.condensed || '无愧于心以自省立诚';
  }

  return extract;
}

const ROOMMATE_FRIEND = /室友|同室|合租|朋友|好友|闺蜜|同学|绝交|闹翻|嫌隙/;
const REAL_XIAOTI_CTX = /爸妈|父母|我妈|我爸|令堂|令尊|问孝|孝顺|兄长|兄弟姊妹/;

/** 检索降权：职场/交游/驳孝悌时不要 1.2 孝弟为本 */
export function shouldPenalizeXiaoTiCorpus(
  context: string,
  entryId: string,
  userScenes: SceneDomain[] = []
): boolean {
  if (entryId !== '1.2') return false;
  if (hasScene(userScenes, '为政') || WORKPLACE.test(context) || NEGATE_XIAOTI.test(context)) {
    return true;
  }
  if (hasScene(userScenes, '交游')) return true;
  // 室友/朋友情谊（哪怕说「像家人」）≠ 孝悌
  if (ROOMMATE_FRIEND.test(context) && !REAL_XIAOTI_CTX.test(context)) return true;
  return false;
}
