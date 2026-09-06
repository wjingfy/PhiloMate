import type { CorpusEntry, UserLens, SceneDomain } from './types';
import { dedupeAffirmationOpener } from './affirmationGuard';
import { dedupeSternOpener } from './sternOpenerGuard';
import { isContextFragileEntry } from './corpusContextGuard';
import { hasScene } from './sceneDetect';
import { fixScenePhraseLeak } from './sceneContext';

/** 生成结果是否仅为省略号/标点（误把沉默当回避） */
export function isEllipsisOnly(text: string): boolean {
  const t = (text || '').replace(/\s/g, '');
  if (!t) return true;
  return /^[…\.。、,，!！?？\s]+$/.test(t) || t === '……' || t === '…';
}

/**
 * 成句是否崩坏/不可读（D12 类：提示符泄漏、数字碎片、字间空格乱拼、成句截断）。
 * 半文言正常输出不应含阿拉伯数字或【】提示栏。
 */
export function looksGarbledConfuciusReply(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return true;
  // 提示块泄漏
  if (/[【】]/.test(t)) return true;
  // 阿拉伯数字（典籍成句不应出现）
  if (/\d/.test(t)) return true;
  // ASCII 结构符 / 管道
  if (/[{}\[\]<>|\\]/.test(t)) return true;
  // 连续单字被空格切开：省 三 己…
  if (/(?:[\u4e00-\u9fff]\s){3,}[\u4e00-\u9fff]/.test(t)) return true;
  // 标点堆叠：： 。 ，
  if (/[。，、：；]\s*[。，、：；]/.test(t)) return true;
  // 收在顿号／逗号上（话没说完）
  if (/[，、：；]$/.test(t)) return true;
  // 成句截断：句末收束后又甩出无述谓的短残片（如「未可也。孟懿子」）
  {
    const m = t.match(/^(.*[。！？])([^\s。！？…]+)$/);
    if (m?.[2]) {
      const frag = m[2];
      // 残片过短、纯汉字、无常见述谓／关系词 → 像只抛人名／起典半截
      if (
        frag.length >= 2 &&
        frag.length <= 6 &&
        /^[\u4e00-\u9fff]+$/.test(frag) &&
        // 残片无述谓／结构虚词（否则像半截分句而非截断人名）
        !/[盖犹正若乃则亦以于为有无勿莫皆俱其之所而可不须宜当]/.test(frag) &&
        !/^(善|然|否|可|已矣|已|诺)$/.test(frag)
      ) {
        return true;
      }
    }
  }
  // 汉字占比过低（夹大量符号/拉丁碎片）
  const han = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (t.length >= 8 && han / t.length < 0.45) return true;
  return false;
}

/**
 * 现代「X式Y」样式标记（柳下惠式直道）。
 * 前≥2、后≥2 汉字夹「式」；白名单正式/格式/仪式/式微。
 * 不误杀论语「式之／式负版者」（轼：前不足2或后仅「之」等单字）。
 */
export const MODERN_SHI_STYLE_RE =
  /([\u4e00-\u9fff]{2,8})式([\u4e00-\u9fff]{2,6})/g;

const MODERN_SHI_STYLE_WHITELIST = /正式|格式|仪式|式微/;

/** 是否含白话「X式Y」样式标记 */
export function hasModernShiStyle(text: string): boolean {
  const t = text || '';
  for (const m of t.matchAll(new RegExp(MODERN_SHI_STYLE_RE.source, 'g'))) {
    if (MODERN_SHI_STYLE_WHITELIST.test(m[0])) continue;
    return true;
  }
  return false;
}

/** 白话「X式Y」→「X之Y」（半文言） */
export function fixModernShiStyle(text: string): string {
  if (!text) return text;
  return text.replace(new RegExp(MODERN_SHI_STYLE_RE.source, 'g'), (all, a: string, b: string) => {
    if (MODERN_SHI_STYLE_WHITELIST.test(all)) return all;
    return `${a}之${b}`;
  });
}

/**
 * 半文言连词对举：两半之间须有逗号（非疏离乃… → 非疏离，乃…）。
 * mid≥2、second 后≥2 汉字，避免误伤「非也／乃尔／虽然」等。
 */
export const CONN_COMMA_PAIRS: ReadonlyArray<{ first: string; second: string }> = [
  { first: '非', second: '乃' },
  { first: '非', second: '实' },
  { first: '未', second: '乃' },
  { first: '虽', second: '然' },
  { first: '虽', second: '犹' },
  { first: '虽', second: '仍' },
  { first: '虽', second: '而' }, // 虽…而…须中间逗号；单用「而」不作必断（温而厉／群而不党）
  { first: '是', second: '非' },
  { first: '既', second: '又' },
  { first: '既', second: '且' },
  { first: '宁', second: '不' },
  { first: '宁', second: '无' },
  { first: '盖', second: '故' },
  { first: '盖', second: '是以' },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 连词两半粘连且缺逗号（两侧各≥2汉字） */
export function looksMissingConnectiveComma(text: string): boolean {
  const t = text || '';
  if (!t) return false;
  for (const { first, second } of CONN_COMMA_PAIRS) {
    const re = new RegExp(
      `${escapeRegExp(first)}[\\u4e00-\\u9fff]{2,}${escapeRegExp(second)}[\\u4e00-\\u9fff]{2,}`
    );
    if (re.test(t)) return true;
  }
  return false;
}

/** 确定性：在第二标记前插入逗号（非疏离乃真质 → 非疏离，乃真质） */
export function fixMissingConnectiveComma(text: string): string {
  if (!text) return text;
  let t = text;
  // 较长 second 优先（盖…是以… 先于 盖…故…）
  const pairs = [...CONN_COMMA_PAIRS].sort(
    (a, b) => b.second.length - a.second.length || b.first.length - a.first.length
  );
  for (const { first, second } of pairs) {
    const re = new RegExp(
      `(${escapeRegExp(first)})([\\u4e00-\\u9fff]{2,})(${escapeRegExp(second)})([\\u4e00-\\u9fff]{2,})`,
      'g'
    );
    t = t.replace(re, '$1$2，$3$4');
  }
  return t;
}

/**
 * 成句白话渗漏或过长无逗：半文言应用「之」不用「的」；禁「自然规律」等今词；
 * 禁现代「X式Y」样式标记；逗号／句号之间汉字连续过长视为未断句；
 * 连词对举缺逗亦视为未断句。
 */
export function looksVernacularOrRunOnConfuciusReply(text: string): {
  hit: boolean;
  reasons: string[];
} {
  const t = (text || '').trim();
  const reasons: string[] = [];
  if (!t) return { hit: false, reasons };

  // 「的」作定语（半文言用「之」）；极少数专名除外
  if (/的/.test(t) && !/的卢/.test(t)) reasons.push('白话「的」');

  const MODERN_COMPOUND_RE =
    /自然规律|客观规律|历史流向|推动过程|具体过程|没有心力|不断的|并非是|主办人|怎么样|什么样|为什么(?!者)|因为(?!之)|所以(?!然)|但是|这个|那个|什么(?!者)/;
  if (MODERN_COMPOUND_RE.test(t)) reasons.push('白话复合词');

  // 现代「X式Y」（柳下惠式直道）；半文言用「之」
  if (hasModernShiStyle(t)) reasons.push('白话「X式Y」');

  // 连词对举两半缺逗（非…乃… / 虽…然／犹／仍／而… 等；单「而」不作必断）
  if (looksMissingConnectiveComma(t)) reasons.push('连词缺逗');

  // 分句过长无内部顿读（≥10 连续汉字）
  for (const part of t.split(/[，。！？、；]/)) {
    const han = (part.match(/[\u4e00-\u9fff]/g) || []).length;
    if (han >= 10) {
      reasons.push(`过长无逗（${han}字）`);
      break;
    }
  }

  return { hit: reasons.length > 0, reasons };
}

/** 当期疏远(4)且无 stack：模型失败时的锚定 fallback */
export function distantCautiousFallback(entry: CorpusEntry, lens: UserLens): string {
  const text = entry.text || '';
  const key = lens.key;

  if (text.includes('不语') && (key === '怪力乱神' || text.includes('怪'))) {
    return '丘不语怪力乱神。';
  }
  if (text.includes('不语') && key === '鬼神') {
    return '丘不语鬼神。';
  }
  if (text.includes('罕言')) {
    return '丘罕言利，而义与命是听。';
  }
  if (text.includes('未知生')) {
    return '未知生，焉知死？';
  }
  if (text.includes('不语')) {
    return `丘不语${key}。`;
  }

  const condensed = (entry.condensed || '').replace(/孔子/g, '丘').replace(/子/g, '丘');
  if (condensed.length > 0 && condensed.length <= 28) {
    return condensed.endsWith('。') ? condensed : `${condensed}。`;
  }
  return '丘不予多言。';
}

/** 孔子口误用用户第一人称时纠正 */
export function fixUserPerspective(text: string): string {
  return text
    .replace(/我妈(?:寄|送|给)的/g, '汝母所寄')
    .replace(/我妈/g, '汝母')
    .replace(/我爸(?:寄|送|给)的/g, '汝父所寄')
    .replace(/我爸/g, '汝父')
    .replace(/我(?:家|的)([\u4e00-\u9fff]{1,4})/g, '汝之$1')
    .replace(/我寄的/g, '汝所寄')
    .replace(/我的/g, '汝之');
}

/** 剥离需典故上下文的硬摘句；修正误用「夫子」称呼用户；禁孔子自称夫子 */
export function fixAnchorArtifacts(text: string, entryId?: string): string {
  let t = text;
  const fragile =
    isContextFragileEntry(entryId || '') ||
    /夫子之求|异乎人之求|固异乎常人|夫子求政/.test(t);

  if (fragile) {
    t = t
      .replace(/夫子求政[^。；]*[。；]?/g, '')
      .replace(/夫子之求[^。；]*[。；]?/g, '')
      .replace(/其求之也[^。；]*[。；]?/g, '')
      .replace(/固异乎常人之求[^。；]*[。；]?/g, '')
      .replace(/其诸异乎人之求[^。；]*[。；]?/g, '')
      .replace(/[。；]{2,}/g, '。')
      .trim();
  }

  // 自称「夫子」→ 丘（典中子贡称谓不可原样入口）
  t = t
    .replace(/如夫子/g, '如丘')
    .replace(/若夫子/g, '若丘')
    .replace(/正若夫子/g, '正若丘')
    .replace(/譬诸夫子/g, '譬诸丘')
    .replace(/夫子温、良、恭、俭、让/g, '丘温良恭俭让')
    .replace(/夫子温良恭俭让/g, '丘温良恭俭让')
    .replace(/夫子以得之/g, '丘以得之')
    .replace(/夫子至于/g, '丘至于');

  t = fixNarratorZiToQiu(t);

  if (/夫子求|夫子之/.test(t) && !/夫子之道|夫子自/.test(t)) {
    t = t.replace(/夫子(?!之道)/g, '汝');
  }

  // 孔子不得自称「子曰／孔子曰」：问后用答曰，其余用曰
  t = fixSelfRefZiYue(t);

  return t.replace(/^[。；]+/, '').trim();
}

/**
 * 论语旁观「子＋行状」：史笔记孔子，成句须改丘自称。
 * 不改子夏／子贡等弟子名；「子曰」走 fixSelfRefZiYue。
 */
export function fixNarratorZiToQiu(text: string): string {
  let t = text || '';
  t = t.replace(/孔子温而厉/g, '丘温而厉');
  t = t.replace(/(?<!君)子温而厉/g, '丘温而厉');
  t = t.replace(/孔子不语/g, '丘不语');
  t = t.replace(/(?<!君)子不语/g, '丘不语');
  t = t.replace(/(?<!君)子罕言/g, '丘罕言');
  t = t.replace(/子钓而不纲/g, '丘钓而不纲');
  t = t.replace(/子弋不射宿/g, '丘弋不射宿');
  return t;
}

/** 成句是孔子口吻：子曰／孔子曰 → 答曰（前有问）或曰 */
export function fixSelfRefZiYue(text: string): string {
  let t = text || '';
  // …问…，子曰 → …问…，答曰
  t = t.replace(/(问[\u4e00-\u9fff]{0,12}[，,]?)子曰/g, '$1答曰');
  t = t.replace(/(问[\u4e00-\u9fff]{0,12}[，,]?)孔子曰/g, '$1答曰');
  t = t.replace(/子曰/g, '曰');
  t = t.replace(/孔子曰/g, '曰');
  // 避免「答曰」被二次处理；「曰曰」兜底
  t = t.replace(/曰曰/g, '曰');
  return t;
}
const WORKPLACE =
  /上司|下属|成员|同事|领导|员工|职员|团队|工作|职|管理|督促|老板|偷懒|施威|宽和|压力|不留情/;

/** 职场/为政输入却生成孝/父母域 → 剔除 */
export function fixDomainMismatch(
  text: string,
  userInput?: string,
  userScenes: SceneDomain[] = []
): string {
  const input = userInput ?? '';
  const workplace = hasScene(userScenes, '为政') || WORKPLACE.test(input);
  if (!workplace) return text;
  if (/父母|唯忧其疾|唯其疾|问孝|孟武伯/.test(text)) {
    if (/施威|宽|严|礼|下属|管理/.test(input)) {
      return '居上宜宽，施威太甚则失和。';
    }
  }

  let t = text
    .replace(/父母唯[^。；]*[。；]?/g, '')
    .replace(/唯其疾[^。；]*[。；]?/g, '')
    .replace(/情之适度[^。；]*[。；]?/g, '')
    .replace(/忧其疾[^。；]*[。；]?/g, '')
    .replace(/[。；]{2,}/g, '。')
    .trim();

  if (t.length < 6 && /施威|宽|严|礼/.test(input)) {
    return '居上宜宽，施威太甚则失和。';
  }
  return t.replace(/^[。；]+/, '').trim();
}

/** 成句硬禁直角引号「」；改为弯引号“” */
export function stripCornerQuotes(text: string): string {
  return (text || '').replace(/「/g, '“').replace(/」/g, '”');
}

function ownSpeechQuotedChunks(anchorText: string): string[] {
  const chunks: string[] = [];
  const re = /(?:孔子|子(?:在[^曰：“”]{0,16})?)曰[：:]?[“"]([^”"]+)[”"]/gu;
  for (const match of anchorText.matchAll(re)) {
    const chunk = (match[1] || '').replace(/\s+/g, '');
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/** 孔子己言直接嵌字；只剥当前 anchor 中孔子己言的引号，保留弟子/古人转述。 */
export function stripZiYueQuotes(text: string, anchorText = ''): string {
  const own = ownSpeechQuotedChunks(anchorText);
  if (!own.length) return text || '';
  return (text || '').replace(/[“"]([^”"]+)[”"]/gu, (whole, inner: string) => {
    const normalized = inner.replace(/\s+/g, '');
    const sameOwnSpeech = own.some((chunk) => {
      const a = chunk.replace(/[^\u4e00-\u9fff]/g, '');
      const b = normalized.replace(/[^\u4e00-\u9fff]/g, '');
      return b.length >= 2 && (a.includes(b) || b.includes(a));
    });
    return sameOwnSpeech ? inner : whole;
  });
}

/** 模型把 anchor 自带的反问/感叹句号化时，按原典恢复 ？/！。 */
export function restoreClassicAskMarks(text: string, anchorText = ''): string {
  let out = text || '';
  for (const match of anchorText.matchAll(/([^。！？“”]{1,32})([？！])/gu)) {
    const clause = (match[1] || '').replace(/[^\u4e00-\u9fff]/g, '');
    const mark = match[2]!;
    for (let n = Math.min(8, clause.length); n >= 2; n--) {
      const suffix = clause.slice(-n);
      const re = new RegExp(`${escapeRegExp(suffix)}[。。，,]`, 'g');
      if (re.test(out)) {
        out = out.replace(re, `${suffix}${mark}`);
        break;
      }
    }
  }
  return out;
}

/**
 * 剥已废止的自造认错开式（丘误矣等）；保留典式池（是也／汝之言然／丘也幸…）
 * 见 sentence_organization.md §7.1
 */
export function stripCraftedAdmissionOpeners(text: string): string {
  let t = (text || '').trim();
  const openers = [
    /^丘误矣[。！，、；]?/,
    /^丘误谓汝[^。！]{0,24}[。！，、；]?/,
    /^丘误谓[^。！]{0,24}[。！，、；]?/,
    /^丘方才以[^。！]{0,36}未合[。！，、；]?/,
    /^丘未察汝[^。！]{0,24}[。！，、；]?/,
    /^丘听偏(?:为|矣)?[^。！]{0,20}[。！，、；]?/,
    /^丘会错汝旨[。！，、；]?/,
    /^适才所论未中汝意[。！，、；]?/,
    /^前言戏之耳[。！，、；]?/,
    /^适才所言戏耳[。！，、；]?/,
  ];
  for (const re of openers) {
    t = t.replace(re, '').trim();
  }
  return t.replace(/^[，、；]+/, '').trim() || text;
}

/** 成句硬禁分号（； / ;）；改顿开为逗号 */
export function stripSemicolons(text: string): string {
  return (text || '')
    .replace(/；/g, '，')
    .replace(/;/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/^[，、]+/, '')
    .replace(/，([。！？])/g, '$1')
    .trim();
}

/** 成句硬禁破折号（—— / — / –）；改顿开为逗号 */
export function stripEmDashes(text: string): string {
  return (text || '')
    .replace(/——+/g, '，')
    .replace(/—+/g, '，')
    .replace(/–+/g, '，')
    .replace(/\u2014+/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/^[，、；]+/, '')
    .replace(/，([。；！？])/g, '$1')
    .trim();
}

/** 成句硬禁省略号（… ……）；改收束为句号 */
export function stripEllipsisMarks(text: string): string {
  return (text || '')
    .replace(/……+/g, '。')
    .replace(/…+/g, '。')
    .replace(/\.{3,}/g, '。')
    .replace(/。{2,}/g, '。')
    .replace(/，。/g, '。')
    .trim();
}

/** 剥掉半句典后的讲义式补释（破折号、意谓、甚是等） */
export function stripAiGlossTail(text: string): string {
  let t = stripEmDashes((text || '').trim());
  t = t
    .replace(/，意谓[^。；]+/g, '')
    .replace(/，此即[^。；]+/g, '')
    .replace(/，汝已行之[。；]?/g, '')
    .replace(/，甚是[。；]?/g, '')
    .replace(/，诚善[。；]?/g, '')
    .replace(/[。；]{2,}/g, '。')
    .replace(/^[，、；]+/, '')
    .trim();
  return t || text;
}

/** 地名误收成单字游历（西安→游于西） */
export function fixPlaceAbbreviationLeak(text: string, userInput?: string): string {
  if (!userInput || !text) return text;
  let t = text;
  if (/西安/.test(userInput) && /游于西(?!安)/.test(t)) {
    if (/健身|耐力|训练|锻炼/.test(userInput)) {
      t = t.replace(/游于西(?!安)/g, '操练');
    } else {
      t = t.replace(/游于西(?!安)/g, '在西安');
    }
  }
  return t;
}

/**
 * 物名过度精简：豆浆粉→粉／浆粉、麦片→片 等，短桥看不出指什么。
 * 豆浆粉：可留全称或收「豆粉」；「浆粉」与单字「粉」扩回「豆粉」。
 */
export function fixOverAbbreviatedConcrete(text: string, userInput?: string): string {
  if (!userInput || !text) return text;
  let t = text;

  if (userInput.includes('豆浆粉')) {
    t = t.replace(/(?<!豆)浆粉/g, '豆粉');
    if (!t.includes('豆浆粉') && !t.includes('豆粉')) {
      const re = /(?<![\u4e00-\u9fff])粉(?=虽|佳|质|，|。|；)/;
      if (re.test(t)) t = t.replace(re, '豆粉');
    }
  }

  const compounds = (userInput.match(/[\u4e00-\u9fff]{2,3}(?:粉|片|酥|饼|粥|面)/g) || [])
    .filter((c) => !c.includes('的') && c.length >= 2 && c !== '豆浆粉' && c !== '豆粉');
  for (const known of ['燕麦片', '蛋黄酥', '方便面', '麦片']) {
    if (userInput.includes(known)) compounds.unshift(known);
  }
  const uniq = [...new Set(compounds)].sort((a, b) => b.length - a.length);
  for (const full of uniq) {
    if (t.includes(full)) continue;
    const short = full.slice(-1);
    const re = new RegExp(`(?<![\\u4e00-\\u9fff])${short}(?=虽|佳|，|。|；)`);
    if (re.test(t)) {
      t = t.replace(re, full);
      break;
    }
  }
  return t;
}

/** 专名并列白话「和」→「与」（孔子口吻）；不动「和为贵」一类 */
export function fixVernacularHeConnector(text: string, userInput?: string): string {
  if (!text) return text;
  let t = text;
  t = t.replace(
    /([\u4e00-\u9fff]{2,8})和([\u4e00-\u9fff]{2,8})/g,
    (all, a: string, b: string) => {
      if (/^(为|尚|贵|也者)/.test(b)) return all;
      const bothInUser =
        !!userInput && userInput.includes(a) && userInput.includes(b);
      const looksProduct =
        /(?:粉|片|酥|饼|粥|面|肉|菜|饭|茶|奶)$/.test(a) ||
        /(?:粉|片|酥|饼|粥|面|肉|菜|饭|茶|奶)$/.test(b);
      if (bothInUser || looksProduct) return `${a}与${b}`;
      return all;
    }
  );
  return t;
}

/** 自修/良心语境误套「信/輗軏」→ 换成立诚向短句 */
export function fixChengXinMismatch(text: string, userInput?: string): string {
  if (!userInput || !/无愧于|不愧对|良心|对得起自己|我自己平时|评价都是次要/.test(userInput)) {
    return text;
  }
  if (!/輗軏|人而无信|人若无信/.test(text)) return text;
  return '汝无愧于心，立诚自重，人言次之。';
}

/** 空壳尾问：整句收尾只有语气词、无实质问旨（语气妆于有内容的问句不剥） */
const EMPTY_SHELL_TAIL =
  /[，,]?\s*(其然|岂其然乎|然乎|何如|女以为何|然否)[？?]?$/;

/** 用户未及出身／门第时，剥掉换典 6.6 temperament 漏进断语的「出身」分句 */
export function stripUnanchoredChushenLeak(
  text: string,
  userInput?: string
): string {
  const u = userInput || '';
  if (/出身|父贱|门第|卑微|犁牛|骍/.test(u)) return text;
  const t = (text || '').trim();
  if (!/出身/.test(t)) return t;
  let next = t
    .replace(/[，,][^，,。！？]*出身[^。！？]*/g, '')
    .replace(/^[^。！？]*出身[^。！？]*[。！？]?/, '')
    .replace(/[。！？]\s*$/, '')
    .trim();
  if (!next || next === t) {
    next = t.replace(/[，,]?\s*才德岂系出身[。！？]?/, '').trim();
  }
  if (!next) return t;
  return /[。！？]$/.test(next) ? next : `${next}。`;
}

export function stripEmptyShellTailCloser(text: string): string {
  const t = (text || '').trim();
  if (!EMPTY_SHELL_TAIL.test(t)) return t;
  const stripped = t.replace(EMPTY_SHELL_TAIL, '').trim();
  if (!stripped) return t;
  return /[。！？]$/.test(stripped) ? stripped : `${stripped}。`;
}

/**
 * 原典嵌用忠实：补回为凑对仗删的字，并恢复被粘掉的逗号排比
 * （坏例：力不同科←为力不同科；志于道据于德←志于道，据于德）
 */
export function fixClassicTruncationForParallel(
  text: string,
  entry: CorpusEntry
): string {
  let t = text || '';
  const src = entry.text || '';
  // 3.16：删「为」凑四字对
  if (/为力不同科/.test(src) && /射不主皮，力不同科/.test(t)) {
    t = t.replace(/射不主皮，力不同科/g, '射不主皮，为力不同科');
  }
  t = restoreClassicParallelCommas(t, src);
  return t;
}

/** 从语料原文抽出引号内成句（子曰：“…”） */
function extractClassicQuotedChunks(entryText: string): string[] {
  const src = entryText || '';
  const chunks: string[] = [];
  for (const m of src.matchAll(/[“「]([^”」]+)[”」]/g)) {
    const q = (m[1] || '').trim();
    if (q.length >= 4) chunks.push(q);
  }
  return chunks;
}

/** 原典排比切片：句号／叹问／分号为分句界，再按逗号／顿号拆（；须与。同级，否则「礼也；今也纯」粘成一块；单字分句如「俭」须保留） */
function* classicCommaParallelSlices(
  entryText: string
): Generator<{ collapsed: string; punctuated: string }> {
  for (const quoted of extractClassicQuotedChunks(entryText)) {
    const clauseChunks = quoted
      .split(/[。！？；]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const clause of clauseChunks.length ? clauseChunks : [quoted]) {
      const parts = clause
        .split(/[，、]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 1);
      if (parts.length < 2) continue;
      for (let n = parts.length; n >= 2; n--) {
        for (let i = 0; i + n <= parts.length; i++) {
          const slice = parts.slice(i, i + n);
          const collapsed = slice.join('');
          if (collapsed.length < 4) continue;
          yield { collapsed, punctuated: slice.join('，') };
        }
      }
    }
  }
}

/**
 * 原文「A，B，C」被粘成「ABC」时，按原文标点补回（优先用，）
 * 亦处理只嵌了前两截的情况（志于道据于德 → 志于道，据于德）
 */
export function restoreClassicParallelCommas(
  text: string,
  entryText: string
): string {
  let t = text || '';
  for (const { collapsed, punctuated } of classicCommaParallelSlices(entryText)) {
    if (!t.includes(collapsed)) continue;
    if (t.includes(punctuated)) continue;
    t = t.split(collapsed).join(punctuated);
  }
  return t;
}

/**
 * 成句仍含「原典逗号排比被粘成无标点汉字串」（restore 未补回或未跑）。
 * 例：9.3「今也纯俭吾从众」←「今也纯，俭，吾从众」
 */
export function looksClassicCommaCollapsed(
  reply: string,
  entry: CorpusEntry | { text?: string }
): boolean {
  const t = reply || '';
  if (!t) return false;
  for (const { collapsed, punctuated } of classicCommaParallelSlices(
    entry.text || ''
  )) {
    if (t.includes(collapsed) && !t.includes(punctuated)) return true;
  }
  return false;
}

function foldPersonHanzi(text: string): string {
  return (text || '')
    .replace(/[^\u4e00-\u9fff]/g, '')
    .replace(/(?<!君)子温而厉/g, '丘温而厉')
    .replace(/(?<!君)子不语/g, '丘不语')
    .replace(/(?<!君)子罕言/g, '丘罕言')
    .replace(/子钓而不纲/g, '丘钓而不纲')
    .replace(/子弋不射宿/g, '丘弋不射宿')
    .replace(/[吾我]/g, '丘')
    .replace(/[尔女]/g, '汝');
}

/** 语料成句汉字（优先引号内子曰；无引号则去「子曰」） */
function classicSpeechHanzi(entryText: string): string {
  const quotes = [...(entryText || '').matchAll(/[“「]([^”」]+)[”」]/g)].map((m) => m[1]);
  const raw = quotes.length ? quotes.join('') : (entryText || '').replace(/子曰/g, '');
  return foldPersonHanzi(raw);
}

/** 成句是否嵌了原文连续 ≥minN 字（人称吾/我↔丘、尔/女↔汝 可折合） */
export function hasEmbeddedClassicSpan(
  reply: string,
  entryText: string,
  minN = 4
): boolean {
  const hay = classicSpeechHanzi(entryText);
  const needle = foldPersonHanzi(reply);
  const n = hay.length < minN ? Math.max(2, hay.length) : minN;
  if (n < 2) return true;
  for (let i = 0; i + n <= hay.length; i++) {
    if (needle.includes(hay.slice(i, i + n))) return true;
  }
  return false;
}

const TITLE_COMPRESS_RE =
  /(?:丘|吾|子夏|子贡|仲弓|颜渊|商)(?:辨|悟)[\u4e00-\u9fff]{4,}/;

const SHORT_SKIP_MODES = new Set([
  'shortened',
  'stack_stern',
  'ellipsis',
  'animation_only',
  'distant_cautious',
]);

/**
 * 缩句根因检测：未嵌原文连续片段，或「丘辨X／子夏悟X」把典压成标题。
 * 短输出档跳过（字数不够嵌可读片段）。
 */
export function looksCompressedTelegramConfuciusReply(
  reply: string,
  entry: CorpusEntry | { text?: string },
  outputMode?: string
): { hit: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const t = (reply || '').trim();
  if (!t) return { hit: false, reasons };
  if (outputMode && SHORT_SKIP_MODES.has(outputMode)) return { hit: false, reasons };

  if (!hasEmbeddedClassicSpan(t, entry.text || '')) {
    reasons.push('未嵌原文连续片段');
  }
  if (TITLE_COMPRESS_RE.test(t)) {
    reasons.push('标题压缩（丘辨X／子夏悟X）');
  }
  return { hit: reasons.length > 0, reasons };
}

/**
 * 句末实质问须带「？」：否／乎／耶／女谓…否 等无问号则补上；误用句号则改问号
 */
export function ensureTailQuestionMark(text: string): string {
  let t = (text || '').trim();
  if (!t) return t;
  t = t.replace(/\?$/u, '？');
  if (/？$/.test(t)) return t;
  // …否。／…乎。 → …
  if (/(?:否|乎|欤|耶|何如|何也|何哉|女以为何)。$/.test(t)) {
    return `${t.slice(0, -1)}？`;
  }
  if (
    /(?:否|乎|欤|耶|何如|何也|何哉|女以为何)$/.test(t) ||
    /女谓.{0,24}否$/.test(t) ||
    /女亦?以为.{0,16}乎$/.test(t)
  ) {
    return `${t}？`;
  }
  return t;
}

/**
 * 断语与尾问用「。」隔开：…，汝…乎？ → …。汝…乎？
 */
export function separateTailQuestionWithPeriod(text: string): string {
  let t = (text || '').trim().replace(/\?$/u, '？');
  if (!/？$/.test(t)) return t;
  // 已有句号隔开则不动
  if (/。[^。！？]*？$/.test(t)) return t;
  const m = t.match(/^(.*)[，,]([^，,。！？]+？)$/);
  if (!m) return t;
  const head = m[1].trim();
  const q = m[2].trim();
  if (!head || !q) return t;
  // 问句侧须像尾问（女/汝/何/乎/否…）
  if (!/(?:女|汝|何|岂|安|否|乎|耶|欤)/.test(q)) return t;
  return `${head}。${q}`;
}

/**
 * 有 exemplar 时：典名首次出现紧跟在「犹／正若／亦／如」之后，且其前已有用户／论断段
 * （如「…犹柳下惠」甩尾）。启发式，宁漏勿误杀过宽。
 */
export function looksExemplarTailSling(reply: string, label?: string): boolean {
  const lab = (label || '').trim();
  if (lab.length < 2) return false;
  const idx = reply.indexOf(lab);
  if (idx < 0) return false;
  const before = reply.slice(0, idx);
  const join = before.match(/(?:犹|正若|亦|如)$/);
  if (!join) return false;
  const head = before.slice(0, before.length - join[0].length).replace(/[，。、；\s]+$/g, '');
  return head.length >= 4;
}

export function polishGeneration(
  text: string,
  outputMode: string,
  entry: CorpusEntry,
  lens: UserLens,
  userInput?: string,
  lastConfuciusReply?: string | null,
  userScenes: SceneDomain[] = []
): string {
  let trimmed = fixUserPerspective((text || '').trim());
  trimmed = fixMissingConnectiveComma(trimmed);
  trimmed = fixAnchorArtifacts(trimmed, entry.id);
  trimmed = fixClassicTruncationForParallel(trimmed, entry);
  trimmed = fixDomainMismatch(trimmed, userInput, userScenes);
  trimmed = fixScenePhraseLeak(trimmed, userScenes);
  trimmed = fixPlaceAbbreviationLeak(trimmed, userInput);
  trimmed = fixOverAbbreviatedConcrete(trimmed, userInput);
  trimmed = fixVernacularHeConnector(trimmed, userInput);
  trimmed = fixModernShiStyle(trimmed);
  trimmed = fixChengXinMismatch(trimmed, userInput);
  trimmed = stripAiGlossTail(trimmed);
  trimmed = stripEmDashes(trimmed);
  trimmed = stripSemicolons(trimmed);
  trimmed = stripCornerQuotes(trimmed);
  trimmed = stripZiYueQuotes(trimmed, entry.text);
  trimmed = restoreClassicAskMarks(trimmed, entry.text);
  trimmed = stripCraftedAdmissionOpeners(trimmed);
  trimmed = stripUnanchoredChushenLeak(trimmed, userInput);
  trimmed = stripEmptyShellTailCloser(trimmed);
  trimmed = dedupeAffirmationOpener(trimmed, lastConfuciusReply);
  trimmed = dedupeSternOpener(trimmed, lastConfuciusReply);
  if (outputMode === 'distant_cautious' && isEllipsisOnly(trimmed)) {
    return distantCautiousFallback(entry, lens);
  }
  if (outputMode === 'ellipsis') {
    return '……';
  }
  trimmed = stripEllipsisMarks(trimmed);
  trimmed = ensureTailQuestionMark(trimmed);
  trimmed = separateTailQuestionWithPeriod(trimmed);
  return trimmed || distantCautiousFallback(entry, lens);
}

/** distant_cautious 且语料 expression=brief 时缩短上限 */
export function effectiveMaxChars(
  outputMode: string,
  baseMax: number,
  frameExpression?: string
): number {
  if (outputMode === 'distant_cautious' && frameExpression === 'brief') {
    return Math.min(baseMax, 24);
  }
  if (outputMode === 'distant_cautious') {
    return Math.min(baseMax, 36);
  }
  return baseMax;
}
