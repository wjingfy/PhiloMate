import type { AttitudeFrame, CorpusEntry, UserLens } from './types';

/**
 * themes 词表「乐」= 乐(lè) 喜悦/欣悦。
 * 语料 attitudeFrames 同 key 可能标注乐(yuè) 音乐，检索与取帧时需辨析。
 */

const YUE_MUSIC =
  /瑟|韶|武|女乐|鼓|音|律|郑声|雅颂|庙|舞|歌|如乐何|丘之门|《韶》|《武》|乐工|乐人|乐舞|崩乐/;

const LE_JOY = /乐之|好之|不亦说|说乎|悦|喜|欣|欢|乐也|乐之者|好之者/;

export function userDiscussesMusic(text: string): boolean {
  return /音乐|乐曲|琴|瑟|韶|武|郑声|女乐|律吕|音律|鼓乐|雅乐|礼乐/.test(text);
}

export function isMusicYueFrame(frame: AttitudeFrame): boolean {
  const blob = `${frame.object}${frame.element}${frame.trigger}${(frame.keywords || []).join('')}`;
  if (frame.target === 'ritual' && YUE_MUSIC.test(blob)) return true;
  return YUE_MUSIC.test(blob);
}

export function isJoyLeFrame(frame: AttitudeFrame): boolean {
  if (isMusicYueFrame(frame)) return false;
  const blob = `${frame.object}${frame.element}${frame.trigger}${(frame.keywords || []).join('')}`;
  return LE_JOY.test(blob) || /喜|悦|说/.test(blob);
}

/** 用户侧 theme 乐(lè)：在多条 乐 帧中选喜悦向，除非用户明确论音乐 */
export function pickLeJoyFrame(
  entry: CorpusEntry,
  lens: UserLens,
  context = ''
): AttitudeFrame | undefined {
  const frames = (entry.attitudeFrames || []).filter(
    (f) => f.lensKind === lens.kind && f.lensKey === lens.key
  );
  if (frames.length === 0) return undefined;
  if (frames.length === 1) return frames[0];

  if (userDiscussesMusic(context)) {
    return frames.find(isMusicYueFrame) || frames[0];
  }
  return (
    frames.find(isJoyLeFrame) ||
    frames.find((f) => !isMusicYueFrame(f)) ||
    frames[0]
  );
}
