import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSentenceModeBlock, resolveSentenceMode } from '../src/services/confucius/sentenceMode.ts';
import {
  replyLooksLikeTailQuestion,
  stripUnauthorizedQuestions,
} from '../src/services/confucius/tailQuestion.ts';
import {
  restoreClassicAskMarks,
  stripZiYueQuotes,
} from '../src/services/confucius/generationPolish.ts';
import {
  inferGlossRepairSubstanceLenses,
  shouldReplaceGlossRepairLenses,
} from '../src/services/confucius/glossRepair.ts';
import {
  isLiveIllnessContext,
  isParentIllnessAliveContext,
  shouldPenalizeCorpusEntry,
} from '../src/services/confucius/corpusContextGuard.ts';
import {
  empathyCorpusScore,
  isConcreteBereavementInput,
  looksCLectureLanding,
} from '../src/services/confucius/moodDetect.ts';
import { shouldCheckBridgeReflect } from '../src/services/confucius/bridgeReflectCheck.ts';
import corpusData from '../src/data/confucius/corpus_annotated.json';
import { configureCorpusEntries, getCorpusEntries } from '../src/services/confucius/corpus.ts';
import type { CorpusEntry } from '../src/services/confucius/types.ts';

configureCorpusEntries(corpusData.entries as unknown as CorpusEntry[]);

test('孔子成句模式区分①直用、②化用、③写清桥', () => {
  assert.equal(
    resolveSentenceMode({
      userInput: '夫子，人为什么必须有信？',
      condensed: '为什么人必须守信',
      path: 'path1',
      reinterpFit: 'tight',
    }),
    'direct'
  );
  assert.equal(
    resolveSentenceMode({
      userInput: '我的猫昨天去世了，好难受',
      condensed: '哀悼宠物去世',
      path: 'path1',
      reinterpFit: 'tight',
    }),
    'hua'
  );
  assert.equal(
    resolveSentenceMode({
      userInput: '红茶味豆浆粉不适合泡麦片',
      condensed: '好喝之物搭配未必合宜',
      path: 'path2',
      hasTension: false,
      reinterpFit: 'loose',
      corpusBridge: '搭配失宜可比恭而无礼之劳',
    }),
    'bridge'
  );
  assert.match(buildSentenceModeBlock('bridge', 52), /③写清桥/);
});

test('原典问号保留，后接的未授权问用户被剥离', () => {
  const anchor = '颜渊死，子哭之恸。从者曰：“子恸矣！”曰：“有恸乎？非夫人之为恸而谁为？”';
  const withExtra = '汝惜猫儿之逝，非夫人之为恸而谁为？女亦以此心自恕乎？';
  assert.equal(replyLooksLikeTailQuestion('非夫人之为恸而谁为？', anchor), false);
  assert.equal(
    stripUnauthorizedQuestions(withExtra, anchor),
    '汝惜猫儿之逝，非夫人之为恸而谁为？'
  );
  assert.equal(
    restoreClassicAskMarks('汝惜猫儿之逝，非夫人之为恸而谁为。', anchor),
    '汝惜猫儿之逝，非夫人之为恸而谁为？'
  );
  assert.equal(
    restoreClassicAskMarks('非夫人之为恸而谁为，汝惜猫之逝。', anchor),
    '非夫人之为恸而谁为？汝惜猫之逝。'
  );
});

test('孔子己言去引号，第三方引语保留', () => {
  assert.equal(
    stripZiYueQuotes('曰：“人而无信，不知其可也。”', '子曰：“人而无信，不知其可也。”'),
    '曰：人而无信，不知其可也。'
  );
  assert.equal(
    stripZiYueQuotes('子贡曰：“夫子温良恭俭让。”', '子贡曰：“夫子温良恭俭让。”'),
    '子贡曰：“夫子温良恭俭让。”'
  );
});

test('亲疾未死禁川上、殡葬与无关亲谏', () => {
  const context = '我妈妈还在ICU住院，情况病危';
  assert.equal(isLiveIllnessContext(context), true);
  assert.equal(isParentIllnessAliveContext(context), true);
  assert.equal(shouldPenalizeCorpusEntry(context, '9.17'), true);
  assert.equal(shouldPenalizeCorpusEntry(context, '10.22'), true);
  assert.equal(shouldPenalizeCorpusEntry(context, '4.18'), true);
  assert.equal(shouldPenalizeCorpusEntry(`${context}，我几谏而她不听`, '4.18'), false);
});

test('C 轮识别讲义落点并降低川上共情分', () => {
  assert.equal(isConcreteBereavementInput('我的猫昨天去世了，好难受'), true);
  assert.equal(looksCLectureLanding('此乃天道之常，心可安矣。', '我的猫去世了'), true);
  assert.equal(
    looksCLectureLanding('逝者如斯夫，不舍昼夜。', '我妈妈还在ICU住院'),
    true
  );
  assert.ok(
    empathyCorpusScore({ text: '子在川上曰：“逝者如斯夫！不舍昼夜。”' }) < 0
  );
});

test('glossRepair 空壳透镜改注仁德友并走实质', () => {
  assert.equal(shouldReplaceGlossRepairLenses([]), true);
  assert.equal(
    shouldReplaceGlossRepairLenses([
      { kind: 'category', key: '名/实', reinterpretation: '纠偏名实' },
    ]),
    true
  );
  const lenses = inferGlossRepairSubstanceLenses(
    { term: '重关系', wrongAs: '谄媚', meantAs: '亲亲上下，并依品性建联' },
    '人没有归属感正常吗',
    '关系本身来自亲亲，品性决定建联'
  );
  assert.deepEqual(lenses.map((lens) => lens.key), ['仁', '德', '友']);
});

test('只有③写清桥运行三义校验', () => {
  assert.equal(shouldCheckBridgeReflect({ corpusBridge: '有桥', sentenceMode: 'direct' }), false);
  assert.equal(shouldCheckBridgeReflect({ corpusBridge: '有桥', sentenceMode: 'hua' }), false);
  assert.equal(shouldCheckBridgeReflect({ corpusBridge: '有桥', sentenceMode: 'bridge' }), true);
});

test('5.27 语料区分内自讼与反刍式自责', () => {
  const entry = getCorpusEntries().find((item) => item.id === '5.27');
  assert.equal(entry?.generationCautionBy, 'manual');
  assert.ok(entry?.generationCaution?.includes('本条褒的是「见过—内自讼」这一稀缺工夫'));
  assert.ok(entry?.generationCaution?.includes('不是戒「想太多／反省过度／自责伤身」'));
  assert.ok(entry?.generationCaution?.includes('勿与「内省不疚，夫何忧何惧」（12.4）混用'));
});

test('9.17 语料带活人亲疾语用警告', () => {
  const entry = getCorpusEntries().find((item) => item.id === '9.17');
  assert.ok(entry?.generationCaution?.includes('重病、住院、ICU而人还在'));
  assert.ok(entry?.generationCaution?.includes('禁止用「逝者如斯／不舍昼夜」'));
});
