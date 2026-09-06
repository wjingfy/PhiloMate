import type { LongTermOutputMode } from '../../utils/confuciusLongTermAttitude';
import type { OutputMode } from './types';

export function resolveOutputMode(
  currentAttitude: number,
  longTermStack: number,
  cumulative: number,
  longTermMode: LongTermOutputMode
): OutputMode {
  if (longTermMode === 'animation_only') return 'animation_only';
  if (longTermMode === 'ellipsis') return 'ellipsis';
  if (longTermStack === 0 && currentAttitude === 4) return 'distant_cautious';
  if (longTermStack > 0 && currentAttitude <= 1 && longTermMode === 'shortened') return 'shortened';
  if (longTermStack > 0 && cumulative === 4) return 'stack_stern';
  if (longTermMode === 'shortened') return 'shortened';
  return 'normal';
}

export function maxCharsForMode(mode: OutputMode): number {
  switch (mode) {
    case 'ellipsis':
    case 'animation_only':
      return 0;
    case 'shortened':
    case 'stack_stern':
      return 10;
    case 'distant_cautious':
    case 'normal':
    default:
      return 50;
  }
}
