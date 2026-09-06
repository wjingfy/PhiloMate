import type { PhilosopherId } from '../types';

import selectionScreen from './assets/branding/selection-screen.webp';
import confuciusSelection from './assets/selection/confucius.webp';
import socratesSelection from './assets/selection/socrates.webp';
import wangyangmingSelection from './assets/selection/wangyangming.webp';
import foucaultSelection from './assets/selection/foucault.webp';
import closeIcon from './assets/branding/icons/close.webp';
import backIcon from './assets/branding/icons/back.webp';
import confirmIcon from './assets/branding/icons/confirm.webp';
import settingsIcon from './assets/branding/icons/settings.webp';
import windowIcon from './assets/branding/icons/window.webp';
import notebookIcon from './assets/branding/icons/notebook.webp';
import careerIcon from './assets/branding/icons/career.webp';
import bagIcon from './assets/branding/icons/bag.webp';
import snackbookIcon from './assets/branding/icons/snackbook.webp';
import thoughtIcon from './assets/branding/icons/thought.webp';
import historyIcon from './assets/branding/icons/history.webp';
import sendIcon from './assets/branding/icons/send.webp';
import addIcon from './assets/branding/icons/add.webp';
import arrangeIcon from './assets/branding/icons/arrange.webp';
import recordIcon from './assets/branding/icons/record.webp';

import confuciusAvatar from './assets/avatars/confucius.webp';
import confuciusAvatarBlush from './assets/avatars/confucius-blush.webp';
import socratesAvatar from './assets/avatars/socrates.webp';
import socratesAvatarBlush from './assets/avatars/socrates-blush.webp';
import wangyangmingAvatar from './assets/avatars/wangyangming.webp';
import wangyangmingAvatarBlush from './assets/avatars/wangyangming-blush.webp';
import foucaultAvatar from './assets/avatars/foucault.webp';
import foucaultAvatarBlush from './assets/avatars/foucault-blush.webp';

import confuciusAction0 from './assets/dialogue/actions/confucius-0.webp';
import confuciusAction23 from './assets/dialogue/actions/confucius-2-3.webp';
import confuciusAction4 from './assets/dialogue/actions/confucius-4.webp';
import socratesAction0 from './assets/dialogue/actions/socrates-0.webp';
import socratesAction23 from './assets/dialogue/actions/socrates-2-3.webp';
import socratesAction4 from './assets/dialogue/actions/socrates-4.webp';
import wangyangmingAction0 from './assets/dialogue/actions/wangyangming-0.webp';
import wangyangmingAction23 from './assets/dialogue/actions/wangyangming-2-3.webp';
import wangyangmingAction4 from './assets/dialogue/actions/wangyangming-4.webp';
import foucaultAction0 from './assets/dialogue/actions/foucault-0.webp';
import foucaultAction23 from './assets/dialogue/actions/foucault-2-3.webp';
import foucaultAction4 from './assets/dialogue/actions/foucault-4.webp';

import spicyStick from './assets/snacks/spicy_stick.webp';
import rouxsongXiaobei from './assets/snacks/rouxsong_xiaobei.webp';
import beefJerky from './assets/snacks/beef_jerky.webp';
import chocolate from './assets/snacks/chocolate.webp';
import boxedMilk from './assets/snacks/boxed_milk.webp';
import socratesWine from './assets/snacks/socrates_diluted_wine.webp';
import socratesFig from './assets/snacks/socrates_fig.webp';
import socratesBread from './assets/snacks/socrates_know_thyself_bread.webp';
import wangTea from './assets/snacks/wang_mountain_tea.webp';
import wangFern from './assets/snacks/wang_longchang_fern.webp';
import wangCake from './assets/snacks/wang_liangnong_cake.webp';
import foucaultBasket from './assets/snacks/foucault_french_basket.webp';
import foucaultSandwich from './assets/snacks/foucault_sandwich_cola.webp';
import foucaultCoffee from './assets/snacks/foucault_black_coffee.webp';
import confuciusGinger from './assets/snacks/ginger.webp';
import confuciusMeal from './assets/snacks/dan_shi_piao_yin.webp';
import confuciusFish from './assets/snacks/yu_kuai.webp';

import balcony from './assets/window/balcony-optimized.webm';
import balconyPoster from './assets/window/balcony-poster.webp';
import seed from './assets/window/plants/seed.webp';
import sprout from './assets/window/plants/sprout.webp';
import sunflower1 from './assets/window/plants/sunflower-1.webp';
import sunflower2 from './assets/window/plants/sunflower-2.webp';
import sunflower3 from './assets/window/plants/sunflower-3.webp';
import banyan1 from './assets/window/plants/banyan-1.webp';
import banyan2 from './assets/window/plants/banyan-2.webp';
import banyan3 from './assets/window/plants/banyan-3.webp';
import hoya1 from './assets/window/plants/hoya-1.webp';
import hoya2 from './assets/window/plants/hoya-2.webp';
import hoya3 from './assets/window/plants/hoya-3.webp';
import lily1 from './assets/window/plants/lily-1.webp';
import lily2 from './assets/window/plants/lily-2.webp';
import lily3 from './assets/window/plants/lily-3.webp';
import rose1 from './assets/window/plants/rose-1.webp';
import rose2 from './assets/window/plants/rose-2.webp';
import rose3 from './assets/window/plants/rose-3.webp';
import hydrangea1 from './assets/window/plants/hydrangea-1.webp';
import hydrangea2 from './assets/window/plants/hydrangea-2.webp';
import hydrangea3 from './assets/window/plants/hydrangea-3.webp';
import chrysanthemum1 from './assets/window/plants/chrysanthemum-1.webp';
import chrysanthemum2 from './assets/window/plants/chrysanthemum-2.webp';
import chrysanthemum3 from './assets/window/plants/chrysanthemum-3.webp';
import clematis1 from './assets/window/plants/clematis-1.webp';
import clematis2 from './assets/window/plants/clematis-2.webp';
import clematis3 from './assets/window/plants/clematis-3.webp';
import birdOfParadise1 from './assets/window/plants/bird-of-paradise-1.webp';
import birdOfParadise2 from './assets/window/plants/bird-of-paradise-2.webp';
import birdOfParadise3 from './assets/window/plants/bird-of-paradise-3.webp';
import monstera1 from './assets/window/plants/monstera-1.webp';
import monstera2 from './assets/window/plants/monstera-2.webp';
import monstera3 from './assets/window/plants/monstera-3.webp';

import thoughtCorner from './assets/features/thought-corner.webp';
import careerBackground from './assets/features/career.webp';
import careerSeagull from './assets/features/seagull.webp';
import wastepaperNote from './assets/wastepaper/note.webp';
import wastepaperOpen from './assets/wastepaper/paper-open.gif';

export const AVATAR_ART: Record<PhilosopherId, { normal: string; blush: string }> = {
  confucius: { normal: confuciusAvatar, blush: confuciusAvatarBlush },
  socrates: { normal: socratesAvatar, blush: socratesAvatarBlush },
  wangyangming: { normal: wangyangmingAvatar, blush: wangyangmingAvatarBlush },
  foucault: { normal: foucaultAvatar, blush: foucaultAvatarBlush },
};

const DIALOGUE_ACTION_ART: Record<PhilosopherId, { zero: string; critical: string; distant: string }> = {
  confucius: { zero: confuciusAction0, critical: confuciusAction23, distant: confuciusAction4 },
  socrates: { zero: socratesAction0, critical: socratesAction23, distant: socratesAction4 },
  wangyangming: { zero: wangyangmingAction0, critical: wangyangmingAction23, distant: wangyangmingAction4 },
  foucault: { zero: foucaultAction0, critical: foucaultAction23, distant: foucaultAction4 },
};

export function avatarFor(philosopherId: PhilosopherId, score: number): string {
  return score >= 80 ? AVATAR_ART[philosopherId].blush : AVATAR_ART[philosopherId].normal;
}

export function dialogueActionFor(philosopherId: PhilosopherId, currentAttitude?: number): string | null {
  if (currentAttitude === 0) return DIALOGUE_ACTION_ART[philosopherId].zero;
  if (currentAttitude === 2 || currentAttitude === 3) return DIALOGUE_ACTION_ART[philosopherId].critical;
  if (currentAttitude === 4) return DIALOGUE_ACTION_ART[philosopherId].distant;
  return null;
}

export const SNACK_ART: Record<string, string> = {
  spicy_stick: spicyStick,
  rouxsong_xiaobei: rouxsongXiaobei,
  beef_jerky: beefJerky,
  chocolate,
  boxed_milk: boxedMilk,
  socrates_diluted_wine: socratesWine,
  socrates_fig: socratesFig,
  socrates_know_thyself_bread: socratesBread,
  wang_mountain_tea: wangTea,
  wang_longchang_fern: wangFern,
  wang_liangnong_cake: wangCake,
  foucault_french_basket: foucaultBasket,
  foucault_sandwich_cola: foucaultSandwich,
  foucault_black_coffee: foucaultCoffee,
  ginger: confuciusGinger,
  dan_shi_piao_yin: confuciusMeal,
  yu_kuai: confuciusFish,
};

function assetRecord(modules: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(modules).map(([path, url]) => {
    const filename = path.split('/').pop() ?? '';
    return [filename.replace(/\.(?:png|webp)$/, ''), url];
  }));
}

export const SNACK_ATLAS_ART = assetRecord(import.meta.glob<string>(
  './assets/snack-icons/atlas/*.png',
  { eager: true, query: '?url', import: 'default' },
));

export const SNACK_GIFT_ART = assetRecord(import.meta.glob<string>(
  './assets/snack-icons/gift/*.png',
  { eager: true, query: '?url', import: 'default' },
));

export const SNACK_LOCKED_ART = assetRecord(import.meta.glob<string>(
  './assets/snack-icons/locked/*.png',
  { eager: true, query: '?url', import: 'default' },
)) as Record<PhilosopherId, string>;

export interface PlantArt {
  id: string;
  name: string;
  stages: [string, string, string];
}

export const PLANT_ART: PlantArt[] = [
  { id: 'sunflower', name: '向日葵', stages: [sunflower1, sunflower2, sunflower3] },
  { id: 'banyan', name: '榕树', stages: [banyan1, banyan2, banyan3] },
  { id: 'hoya', name: '球兰', stages: [hoya1, hoya2, hoya3] },
  { id: 'lily', name: '白百合', stages: [lily1, lily2, lily3] },
  { id: 'rose', name: '红玫瑰', stages: [rose1, rose2, rose3] },
  { id: 'hydrangea', name: '绣球花', stages: [hydrangea1, hydrangea2, hydrangea3] },
  { id: 'chrysanthemum', name: '菊花', stages: [chrysanthemum1, chrysanthemum2, chrysanthemum3] },
  { id: 'clematis', name: '铁线莲', stages: [clematis1, clematis2, clematis3] },
  { id: 'bird-of-paradise', name: '鹤望兰', stages: [birdOfParadise1, birdOfParadise2, birdOfParadise3] },
  { id: 'monstera', name: '龟背竹', stages: [monstera1, monstera2, monstera3] },
];

export function plantVisual(plant: PlantArt, score: number): { src: string; stage: string } {
  if (score < 20) return { src: seed, stage: '种子期' };
  if (score < 40) return { src: sprout, stage: '破土嫩芽' };
  if (score < 60) return { src: plant.stages[0], stage: '幼株' };
  if (score < 80) return { src: plant.stages[1], stage: '生长期' };
  return { src: plant.stages[2], stage: '盛放期' };
}

export function plantVisualForProgress(plant: PlantArt, progress: number): { src: string; stage: string } {
  const normalized = Math.max(0, Math.min(1, progress));
  if (normalized < 0.2) return { src: seed, stage: '种子期' };
  if (normalized < 0.4) return { src: sprout, stage: '破土嫩芽' };
  if (normalized < 0.6) return { src: plant.stages[0], stage: '幼株期' };
  if (normalized < 0.8) return { src: plant.stages[1], stage: '生长期' };
  return { src: plant.stages[2], stage: '盛放期' };
}

export const FEATURE_ART = {
  balcony,
  balconyPoster,
  thoughtCorner,
  careerBackground,
  careerSeagull,
  wastepaperNote,
  wastepaperOpen,
};

export const ICON_ART = {
  close: closeIcon,
  back: backIcon,
  confirm: confirmIcon,
  settings: settingsIcon,
  window: windowIcon,
  notebook: notebookIcon,
  career: careerIcon,
  bag: bagIcon,
  snackbook: snackbookIcon,
  thought: thoughtIcon,
  history: historyIcon,
  send: sendIcon,
  add: addIcon,
  arrange: arrangeIcon,
  record: recordIcon,
} as const;

export type ArtIconName = keyof typeof ICON_ART;

export const BRAND_ART = {
  selectionScreen,
  selectionCharacters: {
    confucius: confuciusSelection,
    socrates: socratesSelection,
    wangyangming: wangyangmingSelection,
    foucault: foucaultSelection,
  } satisfies Record<PhilosopherId, string>,
};
