import type { UserLens } from './types';

/**
 * 概念误读纠偏：用户先用某词/概念 → 上轮孔子按另一义回应 → 本轮用户纠正用词义。
 * 与具体话题无关；供 turnFocus / lens / 成句优先处理。
 */

export interface GlossRepair {
  /** 用户原用的词或概念（短） */
  term: string;
  /** 上轮被听成／当成的义 */
  wrongAs: string;
  /** 用户本意 */
  meantAs: string;
}

function clip(s: string, n: number): string {
  const t = (s || '').replace(/\s+/g, '').trim();
  return t.length <= n ? t : t.slice(0, n);
}

function looksFilled(r: GlossRepair | null | undefined): r is GlossRepair {
  if (!r) return false;
  return Boolean(r.term?.trim() && r.wrongAs?.trim() && r.meantAs?.trim());
}

/** 规范化模型或启发式结果 */
export function normalizeGlossRepair(raw: unknown): GlossRepair | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const term = clip(String(o.term || ''), 16);
  const wrongAs = clip(String(o.wrongAs || o.wrong || ''), 24);
  const meantAs = clip(String(o.meantAs || o.meant || ''), 40);
  if (!term || !wrongAs || !meantAs) return null;
  if (term === wrongAs || wrongAs === meantAs) return null;
  return { term, wrongAs, meantAs };
}

/**
 * 无模型／模型漏填时的通用启发式。
 * 覆盖：「我说的X并非…而是…」「不是…而是…」「你把…理解成…」等，
 * 不绑死某一对话用词。
 */
export function inferGlossRepairHeuristic(params: {
  userInput: string;
  lastAssistantMessage?: string | null;
  lastUserMessage?: string | null;
}): GlossRepair | null {
  const t = (params.userInput || '').replace(/\s+/g, '');
  if (!t || t.length < 10) return null;

  // 我说的A并非是说/并非指 B，而是(指) C
  let m = t.match(
    /我说的(.{1,16}?)并非(?:是说|指|说)?(.{1,20}?)[，,]?而是(?:指)?(.{2,48})/
  );
  if (m) {
    return normalizeGlossRepair({ term: m[1], wrongAs: m[2], meantAs: m[3] });
  }

  // 我说的A不是(说)B，而是(指)C
  m = t.match(/我说的(.{1,16}?)(?:并)?不是(?:说|指)?(.{1,20}?)[，,]?而是(?:指)?(.{2,48})/);
  if (m) {
    return normalizeGlossRepair({ term: m[1], wrongAs: m[2], meantAs: m[3] });
  }

  // 你把A理解成了B（meantAs 从「其实/实际/而是」取，或占位「非此义」）
  m = t.match(/你(?:把|将)(.{1,16}?)理解成了?(.{1,20}?)(?:[，。！？]|$)/);
  if (m) {
    const meant =
      t.match(/(?:其实|实际|本意|而是(?:指)?)(.{2,40})/)?.[1] || '非此义';
    return normalizeGlossRepair({ term: m[1], wrongAs: m[2], meantAs: meant });
  }

  // 并非是说B，而是C —— term 从上轮用户句里找与本句共现、又被上轮孔子回应过的短词
  m = t.match(/并非是说(.{2,20}?)[，,]?而是(?:指)?(.{2,48})/);
  if (m) {
    const term =
      pickSharedTerm(params.lastUserMessage || '', t) ||
      pickTermEchoedByAssistant(params.lastUserMessage || '', params.lastAssistantMessage || '') ||
      '前言';
    return normalizeGlossRepair({ term, wrongAs: m[1], meantAs: m[2] });
  }

  // 不是在说/指 B，而是 C
  m = t.match(/不是(?:在)?(?:说|指)(.{2,20}?)[，,]?而是(?:指)?(.{2,48})/);
  if (m) {
    const term =
      pickSharedTerm(params.lastUserMessage || '', t) ||
      pickTermEchoedByAssistant(params.lastUserMessage || '', params.lastAssistantMessage || '') ||
      '前言';
    return normalizeGlossRepair({ term, wrongAs: m[1], meantAs: m[2] });
  }

  return null;
}

/** 上轮用户与本轮共现的 2～6 字内容词（优先靠后出现的） */
function pickSharedTerm(lastUser: string, current: string): string | null {
  const prev = lastUser.replace(/\s+/g, '');
  const cur = current.replace(/\s+/g, '');
  if (prev.length < 2 || cur.length < 2) return null;
  const hits: string[] = [];
  for (let n = 6; n >= 2; n--) {
    for (let i = 0; i + n <= prev.length; i++) {
      const w = prev.slice(i, i + n);
      if (!/[\u4e00-\u9fff]{2}/.test(w)) continue;
      if (/^(我还|没想|以为|毕竟|夫子|哈哈|这样|那么)/.test(w)) continue;
      if (cur.includes(w)) hits.push(w);
    }
    if (hits.length) break;
  }
  return hits.length ? hits[hits.length - 1]! : null;
}

/** 上轮用户用词在上轮孔子回复里被「接住」过的片段 → 更可能是被误读的 term */
function pickTermEchoedByAssistant(lastUser: string, lastAsst: string): string | null {
  const u = lastUser.replace(/\s+/g, '');
  const a = lastAsst.replace(/\s+/g, '');
  if (u.length < 2 || a.length < 2) return null;
  // 若助手侧出现谄/偏/过等评判，而用户侧有可指称的名词
  const candidates = u.match(/[\u4e00-\u9fff]{2,6}/g) || [];
  for (const w of [...candidates].reverse()) {
    if (/^(我还|没想|以为|毕竟|夫子|哈哈|这样|那么|正常)/.test(w)) continue;
    if (a.includes(w) || /谄|佞|偏|过|不及|恶/.test(a)) {
      // 用户词未进助手句时，仍可用用户侧实词（误读常换义不换字面）
      if (/关系|合度|习惯|中|度|礼|仁|孝|义/.test(w)) return w;
    }
  }
  for (const w of [...candidates].reverse()) {
    if (/关系|合度|习惯|归属|中庸|礼|仁/.test(w)) return w;
  }
  return null;
}

/** condensed 须以误读纠偏打头，避免下游只吃后半新立场 */
export function ensureGlossRepairCondensed(condensed: string, repair: GlossRepair): string {
  const lead = `纠偏上轮把「${repair.term}」听成「${repair.wrongAs}」，实指「${repair.meantAs}」`;
  const c = (condensed || '').trim();
  if (!c) return lead.slice(0, 72);
  const already =
    (/纠偏|听成|误读|听偏/.test(c) && c.includes(repair.term.slice(0, Math.min(2, repair.term.length)))) ||
    (c.includes(repair.wrongAs.slice(0, Math.min(2, repair.wrongAs.length))) &&
      /不是|并非|而是|实指|本意/.test(c));
  if (already) return c.slice(0, 80);
  return `${lead}；${c}`.slice(0, 80);
}

export function glossRepairPromptHint(repair: GlossRepair): string {
  return `glossRepair={term:「${repair.term}」, wrongAs:「${repair.wrongAs}」, meantAs:「${repair.meantAs}」}`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 成句是否已「承认听偏」：认池起句/嵌句 + 显式否定 wrongAs。
 * 仅谈 meantAs／嵌典而无「非 wrongAs」→ 不算。
 */
export function acknowledgesGlossRepair(text: string, repair: GlossRepair): boolean {
  const t = (text || '').replace(/\s+/g, '');
  if (t.length < 4) return false;
  const concede =
    /^(是也|汝之言然|可也)/.test(t) ||
    /(?:^|[。！，、])是也/.test(t) ||
    /汝之言然|之言是也|丘也幸|于汝与改是|吾弗如也/.test(t);
  if (!concede) return false;

  const wrong = (repair.wrongAs || '').trim();
  if (!wrong) return concede;
  // 取 wrongAs 前 2～4 字作核；「偏肉贪饕」→ 偏肉 / 偏
  const cores = [
    wrong.slice(0, Math.min(4, wrong.length)),
    wrong.slice(0, Math.min(2, wrong.length)),
  ].filter((c, i, a) => c && a.indexOf(c) === i);

  const negWrong = cores.some((core) => {
    const c = escapeRe(core);
    return (
      new RegExp(`非(?:是|指|谓|为|倡|说)?[^。！？]{0,8}${c}`).test(t) ||
      new RegExp(`不(?:是|指|谓)?[^。！？]{0,6}${c}`).test(t) ||
      t.includes(`非${core}`)
    );
  });
  return negWrong;
}

/** 重写提示用的短骨架（非强制逐字） */
export function glossRepairSurfaceHint(repair: GlossRepair): string {
  const meant = clip(repair.meantAs, 16);
  return `是也。${repair.term}非${repair.wrongAs}，乃${meant}`;
}

/**
 * 透镜／选典用问旨：锚定「原概念 + 本义」，不把「纠偏行为」当论题。
 * 成句认听偏另走 glossRepair 硬块。
 */
export function buildGlossRepairTopicCondensed(params: {
  repair: GlossRepair;
  lastUserMessage?: string | null;
  openQuestion?: string | null;
}): string {
  const { repair } = params;
  const prior = `${params.lastUserMessage || ''}${params.openQuestion || ''}`.replace(/\s+/g, '');
  const termCore = repair.term.slice(0, Math.min(2, repair.term.length));
  let priorBite = '';
  if (prior && termCore && prior.includes(termCore)) {
    // 截一段含原词的上文用户主张，供续论
    const idx = prior.indexOf(termCore);
    const start = Math.max(0, idx - 8);
    priorBite = prior.slice(start, start + 36);
  }
  const substance = `${repair.term}本义：${repair.meantAs}`;
  if (priorBite) {
    return `按本义重答被听偏之句：「${repair.term}」指${repair.meantAs}（上文：${priorBite}）`.slice(0, 72);
  }
  return `按本义重答被听偏之句：${substance}`.slice(0, 72);
}

/** 空 lens 或只剩纠偏动作轴时，须回到概念实质，不可走无典短应。 */
export function shouldReplaceGlossRepairLenses(lenses: UserLens[] | null | undefined): boolean {
  if (!lenses?.length) return true;
  return lenses.every((lens) => /^(?:名\/?实|知\/?不知|名实|知不知)$/.test(lens.key.trim()));
}

/** 从用户澄清的本义推回可检索的实质 theme。 */
export function inferGlossRepairSubstanceLenses(
  repair: GlossRepair,
  lastUserMessage?: string | null,
  currentUserMessage?: string | null
): UserLens[] {
  const text = `${repair.term}${repair.meantAs}${lastUserMessage || ''}${currentUserMessage || ''}`;
  const lenses: UserLens[] = [];
  const add = (key: string, reinterpretation: string) => {
    if (lenses.some((lens) => lens.key === key)) return;
    lenses.push({
      kind: 'theme',
      key,
      reinterpretation,
      mentionReason: 'gloss_repair_substance',
    });
  };

  if (/亲亲|人伦|亲疏|父母|家人|上下|关系本身|归属/.test(text)) {
    add('仁', `${repair.term}本义落在人伦亲爱，而非${repair.wrongAs}`);
  }
  if (/品性|品格|德性|德行|人格|善恶|好人|恶人/.test(text)) {
    add('德', `${repair.term}依品性德行而立，而非${repair.wrongAs}`);
  }
  if (/建联|交友|朋友|结交|相交|交往|联结/.test(text)) {
    add('友', `${repair.term}关乎择友建联，而非${repair.wrongAs}`);
  }

  // 无明显词面时仍落到“仁”，避免回到名实纠偏专题或空 lens。
  if (!lenses.length) add('仁', `${repair.term}须按其本义续论，而非${repair.wrongAs}`);
  return lenses;
}

export { looksFilled as isGlossRepairFilled };
