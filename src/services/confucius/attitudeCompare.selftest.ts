/**
 * 再解释智能比照 → 态度定档纯函数自测（无 API）
 * 运行: npx --yes tsx src/services/confucius/attitudeCompare.selftest.ts
 */
import { mapAttitudeFromCompare, type ReinterpCompareResult } from './attitudeCompare';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cmp(
  fit: ReinterpCompareResult['fit'],
  stanceRelation: ReinterpCompareResult['stanceRelation'],
  reason = 't'
): ReinterpCompareResult {
  return { fit, stanceRelation, reason, viaModel: false };
}

// tight+same + reject → 0（同斥所斥，欣赏用户；1.12 类）
{
  const r = mapAttitudeFromCompare(2, cmp('tight', 'same'));
  assert(r.attitude === 0 && r.inverted && r.alignment === 'match', 'same reject 2→0');
}
{
  const r = mapAttitudeFromCompare(3, cmp('tight', 'same'));
  assert(r.attitude === 0 && r.inverted, 'same reject 3→0');
}
{
  const r = mapAttitudeFromCompare(0, cmp('tight', 'same'));
  assert(r.attitude === 0 && !r.inverted, 'same praise 沿用0');
}
{
  const r = mapAttitudeFromCompare(1, cmp('tight', 'same'));
  assert(r.attitude === 1, 'same mild 沿用1');
}

// tight+opposite：赞所斥保持 2/3；斥所赞 0→2
{
  const r = mapAttitudeFromCompare(2, cmp('tight', 'opposite'));
  assert(r.attitude === 2 && !r.inverted && r.alignment === 'mismatch', 'opp 保持2');
}
{
  const r = mapAttitudeFromCompare(0, cmp('tight', 'opposite'));
  assert(r.attitude === 2 && r.inverted, 'opp 0→2');
}
{
  const r = mapAttitudeFromCompare(1, cmp('tight', 'opposite'));
  assert(r.attitude === 1, 'opp base1 沿用');
}
{
  const r = mapAttitudeFromCompare(4, cmp('tight', 'opposite'));
  assert(r.attitude === 4, 'opp base4 保持');
}

// loose / inquire → 1
{
  const r = mapAttitudeFromCompare(2, cmp('loose', 'same'));
  assert(r.attitude === 1 && r.softened, 'loose+same→1');
}
{
  const r = mapAttitudeFromCompare(3, cmp('tight', 'inquire'));
  assert(r.attitude === 1 && r.softened, 'inquire→1');
}

console.log('attitudeCompare.selftest: ok');
