/** 立场字段命名与 stance → 0–4 映射（全队统一） */

export const STANCE_VALUES = [
  'praise',
  'method',
  'neutral_explain',
  'reject',
  'lament',
  'refuse_talk',
] as const;

export type StanceValue = (typeof STANCE_VALUES)[number];

const STANCE_SET = new Set<string>(STANCE_VALUES);

const STANCE_TO_LEVEL: Record<StanceValue, number> = {
  praise: 0,
  method: 1,
  neutral_explain: 1,
  lament: 1,
  reject: 2,
  refuse_talk: 4,
};

const ALIAS_KEYS = [
  'stance',
  'position',
  'attitude',
  'view',
  'judgment',
  'xxxStance',
];

export function stanceFieldName(philosopherId: string): string {
  return `${philosopherId}Stance`;
}

export function isStanceValue(s: unknown): s is StanceValue {
  return typeof s === 'string' && STANCE_SET.has(s);
}

export function mapStanceToLevel(stance: string | undefined): number {
  if (isStanceValue(stance)) return STANCE_TO_LEVEL[stance];
  return 1;
}

export function readFrameStance(
  frame: Record<string, unknown> | null | undefined,
  philosopherId: string,
): string {
  if (!frame) return 'neutral_explain';
  const key = stanceFieldName(philosopherId);
  const direct = frame[key];
  if (typeof direct === 'string' && direct) return direct;
  const legacy = frame.confuciusStance;
  if (typeof legacy === 'string' && legacy) return legacy;
  const fallback = frame.stance;
  if (typeof fallback === 'string' && fallback) return fallback;
  return 'neutral_explain';
}

export function readFrameAttitudeLevel(
  frame: Record<string, unknown> | null | undefined,
  philosopherId: string,
): number {
  if (frame && typeof frame.attitudeLevel === 'number' && frame.attitudeLevel >= 0 && frame.attitudeLevel <= 4) {
    return Math.floor(frame.attitudeLevel);
  }
  return mapStanceToLevel(readFrameStance(frame, philosopherId));
}

/** 把帧上的立场键收成 `{id}Stance`，并补 attitudeLevel */
export function normalizeAttitudeFrame(
  frame: Record<string, unknown>,
  philosopherId: string,
): { frame: Record<string, unknown>; renamedFrom: string[] } {
  const want = stanceFieldName(philosopherId);
  const renamedFrom: string[] = [];
  const next = { ...frame };

  let value: string | undefined;
  if (typeof next[want] === 'string' && next[want]) {
    value = next[want] as string;
  }

  for (const [k, v] of Object.entries(next)) {
    if (k === want) continue;
    const isAlias =
      k === 'confuciusStance' ||
      k.endsWith('Stance') ||
      ALIAS_KEYS.includes(k);
    if (!isAlias || typeof v !== 'string' || !v) continue;
    if (!value) value = v;
    if (k !== want) {
      renamedFrom.push(k);
      delete next[k];
    }
  }

  if (!value) value = 'neutral_explain';
  next[want] = value;
  if (typeof next.attitudeLevel !== 'number' || next.attitudeLevel < 0 || next.attitudeLevel > 4) {
    next.attitudeLevel = mapStanceToLevel(value);
  }

  return { frame: next, renamedFrom };
}
