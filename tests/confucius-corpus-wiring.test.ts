import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFUCIUS_FULL_CORPUS_MIN_ENTRIES,
  shouldLoadCompleteCorpus,
} from '../src/services/dialogue/dataLoader.ts';

test('Confucius web wiring replaces a keyword-truncated corpus with the complete pool', () => {
  assert.equal(shouldLoadCompleteCorpus('confucius', 28), true);
  assert.equal(shouldLoadCompleteCorpus('confucius', 120), true);
  assert.equal(shouldLoadCompleteCorpus('confucius', 512), false);
  assert.equal(CONFUCIUS_FULL_CORPUS_MIN_ENTRIES, 500);
});

test('other philosopher roles continue using the lightweight Top-K corpus search', () => {
  assert.equal(shouldLoadCompleteCorpus('socrates', 28), false);
  assert.equal(shouldLoadCompleteCorpus('foucault', 28), false);
});
