import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countForeignTerms,
  detectOutputDefects,
  hitFusedForeignTerm,
  hitUnglossedForeignTerm,
  polishOutput,
} from '../src/services/foucault/v3/compose.ts';
import { entries } from '../src/services/foucault/v3/corpus.ts';
import { isBereavementInput } from '../src/services/foucault/v3/pipeline.ts';
import { resolveOutputMode } from '../src/services/foucault/v3/stack.ts';

test('福柯 3.0 保留多词外文术语空格并执行出口复检', () => {
  const text = polishOutput(
    '  ta pragmata（这些东西本身） 与 chrēsis aphrodisiōn（快感的享用）  ',
    300,
  );
  assert.match(text, /ta pragmata/);
  assert.match(text, /chrēsis aphrodisiōn/);
  assert.equal(countForeignTerms(text), 2);
  assert.equal(hitUnglossedForeignTerm(text), false);
  assert.equal(hitFusedForeignTerm(text), false);
  assert.deepEqual(detectOutputDefects(text), []);
  assert.ok(detectOutputDefects('这份开心是实打实的。').includes('label'));
});

test('福柯 3.0 识别亲密关系撤除并采用放宽后的正常字数', () => {
  assert.equal(isBereavementInput('相伴十年的挚友和我绝交了'), true);
  assert.equal(isBereavementInput('今天想早点休息'), false);
  assert.deepEqual(resolveOutputMode(1, 0), { outputMode: 'normal', maxChars: 300 });
});

test('福柯 3.0 语料合并保留 DP、EOP 与现有 HS 全集', () => {
  assert.equal(entries.filter((entry) => entry.id.startsWith('DP-')).length, 145);
  assert.equal(entries.filter((entry) => entry.id.startsWith('EOP-')).length, 19);
  assert.equal(entries.filter((entry) => entry.id.startsWith('HS-')).length, 148);
  assert.match(
    entries.find((entry) => entry.id === 'EOP-04')?.generationCaution ?? '',
    /只以福柯自身的受苦经历作陪伴/,
  );
});
