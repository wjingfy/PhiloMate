import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const VALID_IDS = ['confucius', 'socrates', 'wangyangming', 'foucault'];
const requestedIndex = process.argv.indexOf('--id');
const requested = requestedIndex >= 0 ? process.argv[requestedIndex + 1] : null;
const ids = requested ? [requested] : VALID_IDS;
const required = [
  'themes_vocabulary.json',
  'categories_vocabulary.json',
  'corpus_annotated.json',
  'attitudes.json',
  'covered.json',
  'sentence_organization.md',
  'distant_cautious.json',
  'sensitive_topics.json',
  'nameplate.json',
  'wastepaper_corpus.json',
  'proactive_questions.json',
  'proactive_experiences.json',
  'snack_evaluations.json',
  'snack_return_pool.json',
];
const stanceValues = new Set(['praise', 'method', 'neutral_explain', 'reject', 'lament', 'refuse_talk']);
const errors = [];
const warnings = [];

if (ids.some((id) => !VALID_IDS.includes(id))) {
  console.error(`philosopherId 只允许：${VALID_IDS.join(' / ')}`);
  process.exit(2);
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

for (const id of ids) {
  const root = resolve('src', 'data', id);
  for (const file of required) {
    try {
      await access(resolve(root, file));
    } catch {
      errors.push(`${id}: 缺少 ${file}`);
    }
  }
  if (errors.some((error) => error.startsWith(`${id}: 缺少`))) continue;

  const [themePackage, categoryPackage, corpusPackage, covered, snacks, nameplate] = await Promise.all([
    json(resolve(root, 'themes_vocabulary.json')),
    json(resolve(root, 'categories_vocabulary.json')),
    json(resolve(root, 'corpus_annotated.json')),
    json(resolve(root, 'covered.json')),
    json(resolve(root, 'snack_evaluations.json')),
    json(resolve(root, 'nameplate.json')),
  ]);
  const themes = new Set(themePackage.coreThemes ?? []);
  const categories = new Set(categoryPackage.flatList ?? []);
  const entries = corpusPackage.entries;
  if (corpusPackage.philosopherId !== id) errors.push(`${id}: corpus philosopherId=${corpusPackage.philosopherId}`);
  if (nameplate.philosopherId !== id) errors.push(`${id}: nameplate philosopherId=${nameplate.philosopherId}`);
  if (!Array.isArray(entries) || !entries.length) {
    errors.push(`${id}: corpus entries 为空`);
    continue;
  }
  const seen = new Set();
  for (const entry of entries) {
    const prefix = `${id}:${entry?.id ?? '(no-id)'}`;
    for (const field of ['id', 'text', 'annotationType', 'layer', 'condensed', 'themes', 'categories', 'attitudeFrames']) {
      if (!(field in (entry ?? {}))) errors.push(`${prefix}: 缺字段 ${field}`);
    }
    if (seen.has(entry.id)) errors.push(`${prefix}: id 重复`);
    seen.add(entry.id);
    for (const key of entry.themes ?? []) if (!themes.has(key)) errors.push(`${prefix}: 未知 theme ${key}`);
    for (const key of entry.categories ?? []) if (!categories.has(key)) errors.push(`${prefix}: 未知 category ${key}`);
    if (entry.annotationType === 'B') {
      if (!Array.isArray(entry.temperaments)) errors.push(`${prefix}: B 缺 temperaments`);
      if (!entry.exemplar) errors.push(`${prefix}: B 缺 exemplar`);
    }
    for (const frame of entry.attitudeFrames ?? []) {
      const stance = frame[`${id}Stance`];
      if (!stanceValues.has(stance)) errors.push(`${prefix}: 非法或缺失 ${id}Stance`);
      if (typeof frame.attitudeLevel !== 'number' || frame.attitudeLevel < 0 || frame.attitudeLevel > 4) {
        errors.push(`${prefix}: attitudeLevel 非 0–4`);
      }
    }
  }
  const coveredThemes = new Set(covered.coveredThemes ?? []);
  const coveredCategories = new Set(covered.coveredCategories ?? []);
  for (const key of coveredThemes) if (!themes.has(key)) warnings.push(`${id}: covered theme 不在词表：${key}`);
  for (const key of coveredCategories) if (!categories.has(key)) warnings.push(`${id}: covered category 不在词表：${key}`);
  if (!Array.isArray(snacks.evaluations) || snacks.evaluations.length !== 14) {
    errors.push(`${id}: snack_evaluations 应为 14 条，实际 ${snacks.evaluations?.length ?? 0}`);
  }
  console.log(`✓ ${id}: ${entries.length} 条语料，${themes.size} themes，${categories.size} categories`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length) {
  for (const error of errors.slice(0, 100)) console.error(`ERROR ${error}`);
  if (errors.length > 100) console.error(`…另有 ${errors.length - 100} 项`);
  process.exit(1);
}
console.log(`ALIGN_OK (${ids.join(', ')})`);
