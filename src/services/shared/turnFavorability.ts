/**
 * 态度挂钩好感（G1 / R1）。面板/零回复时 countFavorability=false。
 * 日上限与总分上限仍由 favorability.ts 在写入时裁。
 */
export function attitudeLinkedFavorabilityDelta(input: {
  currentAttitude: number;
  longTermStack: number;
  triggeredLongTerm: boolean;
  countFavorability?: boolean;
}): { g1: number; r1: number; net: number } {
  if (input.countFavorability === false) {
    return { g1: 0, r1: 0, net: 0 };
  }
  const r1 = input.triggeredLongTerm ? -5 : 0;
  const g1 =
    input.longTermStack <= 0 && input.currentAttitude === 0 ? 1 : 0;
  return { g1, r1, net: g1 + r1 };
}
