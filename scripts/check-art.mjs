import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('src/ui/assets');
const roles = ['confucius', 'socrates', 'wangyangming', 'foucault'];
const snacks = [
  'spicy_stick', 'rouxsong_xiaobei', 'beef_jerky', 'chocolate', 'boxed_milk',
  'socrates_diluted_wine', 'socrates_fig', 'socrates_know_thyself_bread',
  'wang_mountain_tea', 'wang_longchang_fern', 'wang_liangnong_cake',
  'foucault_french_basket', 'foucault_sandwich_cola', 'foucault_black_coffee',
  'ginger', 'dan_shi_piao_yin', 'yu_kuai',
];
const plants = [
  'sunflower', 'banyan', 'hoya', 'lily', 'rose', 'hydrangea',
  'chrysanthemum', 'clematis', 'bird-of-paradise', 'monstera',
];
const icons = [
  'close', 'back', 'confirm', 'settings', 'window', 'notebook', 'career', 'bag',
  'snackbook', 'thought', 'history', 'send', 'add', 'arrange', 'record', 'search',
];

const expected = [
  ...roles.flatMap((id) => [`avatars/${id}.webp`, `avatars/${id}-blush.webp`]),
  ...roles.flatMap((id) => ['0', '2-3', '4'].map((attitude) => `dialogue/actions/${id}-${attitude}.webp`)),
  ...snacks.map((id) => `snacks/${id}.webp`),
  ...snacks.flatMap((id) => [`snack-icons/atlas/${id}.png`, `snack-icons/gift/${id}.png`]),
  ...roles.map((id) => `snack-icons/locked/${id}.png`),
  'window/balcony.webm',
  'window/plants/seed.webp',
  'window/plants/sprout.webp',
  ...plants.flatMap((id) => [1, 2, 3].map((stage) => `window/plants/${id}-${stage}.webp`)),
  'wastepaper/note.webp',
  'wastepaper/paper-open.gif',
  'features/thought-corner.webp',
  'features/career.webp',
  'features/seagull.webp',
  'branding/logo.webp',
  ...icons.map((name) => `branding/icons/${name}.webp`),
  'branding/selection-screen.webp',
];

let bytes = 0;
for (const relative of expected) {
  const info = await stat(resolve(root, relative));
  if (!info.isFile() || info.size <= 0) throw new Error(`invalid_art_asset:${relative}`);
  bytes += info.size;
}

console.log(`ART_CHECK_OK files=${expected.length} runtimeMB=${(bytes / 1024 / 1024).toFixed(2)}`);
