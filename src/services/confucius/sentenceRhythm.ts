/**
 * 论语句式节奏妆点（短句拆分硬；同字数一对为妆点）
 * 细则见 sentence_organization.md「句式节奏」；原典照录／让步逻辑见语气通用约束，此处不重复。
 */

/** 本轮要求「一对同字数短句」的概率（妆点，非每轮必有） */
export const SENTENCE_RHYTHM_PAIR_PROBABILITY = 0.3;

export function shouldRequireParallelPair(roll = Math.random()): boolean {
  return roll < SENTENCE_RHYTHM_PAIR_PROBABILITY;
}

/**
 * 注入成句 prompt。
 * @param requirePair true=本轮须恰好一对同字数；false=本轮不对仗，断句仍硬
 */
export function buildSentenceRhythmPromptBlock(requirePair: boolean): string {
  const pairLine = requirePair
    ? `- **本轮可有且仅有一对**同字数短句（妆点；装不下或会缩句则不对仗）；**禁止**叠两对以上`
    : `- **本轮不对仗**：断句与去缩句仍硬，勿硬凑同字数`;

  return `
【句式节奏】
**断句硬**：语义完整下拆短句，善用逗号，禁分号。对仗可无，缩句不可有。连词两半（非…乃／虽…然／犹／仍／而／是…非等）中间须逗号，禁粘连；单「而」不作必断。
${pairLine}
- **去缩句味（硬）**：禁电报式名词堆叠（如「子夏悟绘事后素，文饰意趣终须质实为底」；「辨变中义理即常也」）。短句之间用「而／则／之」（合关系亦可盖/乃/亦），像回话，不像摘要标签
- 例坏：商悟绘事后素，汝以美为质，亦先立本再施文也
- 例好：子夏问诗，答曰绘事后素，文须以素为质，而美乃可立也
- 对仗只在用户侧/结论侧自造句；原典开引后不拆、不改所引片段标点（见语气通用约束⑤⑦；所引可短可长，非必须两逗号整截）。勿为对仗省略让步/转折逻辑词
`;
}
