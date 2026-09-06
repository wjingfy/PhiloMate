/** 脱离语境则不知所云 / 易误读施受的语料（勿硬摘句） */
export const CONTEXT_FRAGILE_CORPUS_IDS = new Set(['1.10', '2.9']);

const WORKPLACE =
  /上司|下属|成员|同事|领导|员工|职员|团队|工作|职|管理|督促|老板|偷懒|施威|宽和|压力|不留情/;

const DIET_CONTEXT =
  /荤素|蔬菜|素菜|素食|吃素|蛋白质|碳水|吃肉|食肉|肉食|豆浆|麦片|饮食|胜食气|失饪/;

const INTERPERSONAL =
  /交友|朋友|同事|待人|对人|推己|人己|邦|家|怨|人际|相处|恕人|施于人|礼之用/;

const LIVE_ILLNESS_SUBJECT =
  /亲友|亲人|家人|父母|爸妈|我妈|我爸|母亲|父亲|朋友|好友|室友|同学|恋人|伴侣|孩子|宠物|猫|狗/;
const LIVE_ILLNESS_STATE = /住院|病危|重病|重症|ICU|重症监护|昏迷|抢救|手术|患病|生病/;
const DEATH_CONFIRMED = /去世|逝世|身亡|死亡|死了|离世|已故|亡故|不在了/;

export function isLiveIllnessContext(context: string): boolean {
  return (
    LIVE_ILLNESS_SUBJECT.test(context) &&
    LIVE_ILLNESS_STATE.test(context) &&
    !DEATH_CONFIRMED.test(context)
  );
}

export function isParentIllnessAliveContext(context: string): boolean {
  return /父母|爸妈|我妈|我爸|母亲|父亲|令堂|令尊/.test(context) && isLiveIllnessContext(context);
}

/** 职场语境下禁止套孝/父母等家庭语料；饮食禁套绘事后素/知和而和/己所不欲 */
export function shouldPenalizeCorpusEntry(
  context: string,
  entryId: string,
  entry?: { themes?: string[]; text?: string; condensed?: string }
): boolean {
  // 活人亲疾不得套“逝者如斯”或“于我殡”；也不得无端转成亲谏。
  if (isLiveIllnessContext(context) && (entryId === '9.17' || entryId === '10.22')) {
    return true;
  }
  if (
    isLiveIllnessContext(context) &&
    entryId === '4.18' &&
    !/顶撞|几谏|谏|不听|违命|逆亲|劝谏/.test(context)
  ) {
    return true;
  }

  if (entryId === '1.10' && WORKPLACE.test(context)) return true;
  if (entryId === '1.10' && /管理|下属|施威|宽|偷懒|压力/.test(context)) return true;

  if (WORKPLACE.test(context) && entry) {
    const blob = `${entry.text || ''}${entry.condensed || ''}`;
    if (entry.themes?.includes('孝') || entry.themes?.includes('悌')) return true;
    if (/父母|问孝|孟武伯|唯.*疾之忧|孝弟|孝悌/.test(blob)) return true;
    if (entryId === '2.6' || entryId === '1.2' || entryId === '1.6') return true;
  }

  // 室友/朋友（含「像家人」）≠ 孝悌家亲语料
  const roommateFriend =
    /室友|同室|合租|朋友|好友|闺蜜|同学|绝交|闹翻|嫌隙/.test(context);
  const realXiaoTi = /爸妈|父母|我妈|我爸|令堂|令尊|问孝|孝顺|兄长/.test(context);
  if (
    roommateFriend &&
    !realXiaoTi &&
    (entryId === '1.2' || entryId === '2.6' || entryId === '1.6')
  ) {
    return true;
  }

  // 3.8 绘事后素：本/末·礼后，非「蔬菜/荤素」之素
  if (entryId === '3.8') {
    const dietSu =
      /荤素|蔬菜|素菜|素食|吃素|蛋白质|碳水|吃肉|食肉|肉食/.test(context);
    const metaOk = /绘事|后素|素以为|礼后|文饰|文质|本\/末|本质先于/.test(context);
    if (dietSu && !metaOk) return true;
  }

  // 1.12 知和而和：礼之用·人际节文，非饮食合度
  if (entryId === '1.12' && DIET_CONTEXT.test(context) && !INTERPERSONAL.test(context)) {
    return true;
  }

  // 己所不欲（12.2 / 15.24）：恕以待人，非「勿强己身多食肉」
  if (
    (entryId === '12.2' || entryId === '15.24') &&
    DIET_CONTEXT.test(context) &&
    !INTERPERSONAL.test(context)
  ) {
    return true;
  }

  // 1.13：信近于义≠「虽信」之相信；恕道勿劝赴死勿硬套整章「信必近义」
  if (entryId === '1.13') {
    const epistemicBelieve =
      /虽信|相信|深信|坚信|信实践|信.*改善/.test(context) &&
      !/守信|信用|言可复|诺言|失信|人而无信/.test(context);
    const shuSacrifice =
      /恕|劝人|送命|赴死|牺牲|不强求|勿施|推己/.test(context) &&
      !/守信|信用|言可复|恭近|耻辱/.test(context);
    if (epistemicBelieve || shuSacrifice) return true;
  }

  // 1.3 巧言令色：斥虚伪辞色，非赞「暗记他人所爱」之体贴
  if (entryId === '1.3') {
    const care =
      /关爱|体贴|关心|关怀|在意|记挂|关照|学妹|角色|表达关注|记住|暗记|动画片|没怎么看|特意/.test(
        context
      );
    const fakeRen = /巧言|令色|花言巧语|讨好|鲜矣仁|谄|佞/.test(context);
    if (care && !fakeRen) return true;
  }

  // 9.6 吾少也贱：少=年少穷苦，≠睡得少/少眠之「少」
  if (entryId === '9.6') {
    const sleepAmt =
      /睡得少|少眠|睡眠不足|缺觉|没睡|失眠|睡姿|昏沉|刚醒|起床/.test(context);
    const multiSkill =
      /多能|多才|技艺|鄙事|天纵|圣者|为何多能|怎么这么能/.test(context);
    if (sleepAmt && !multiSkill) return true;
  }

  // 1.15：仅当本轮在纠「品格必然 vs 偶发」时降权；纯蜕皮陈述不因话题降权
  if (entryId === '1.15') {
    const moralVsAccident =
      /品格|不贤|见不贤/.test(context) &&
      /并非|非品格|不是.*不贤|意外|偶然|受惊|脱落所致/.test(context);
    const povertyRite = /贫|富|无谄|无骄|好礼|切磋|琢磨|告往/.test(context);
    if (moralVsAccident && !povertyRite) return true;
  }

  return false;
}

/** 职场宽严语境加分语料；饮食语境加分乡党食节；恕道勿劝赴死抬 15.24/12.2 */
export function boostWorkplaceCorpusScore(
  score: number,
  entryId: string,
  context: string
): number {
  if (WORKPLACE.test(context)) {
    if (entryId === '3.26' && /宽|施威|不留情|宽和|居上|偷懒|压力/.test(context)) score += 18;
    if (entryId === '3.19' && /下属|管理|领导|礼|偷懒/.test(context)) score += 14;
    if (entryId === '1.8' && /威|重|不严/.test(context)) score += 6;
  }
  if (DIET_CONTEXT.test(context)) {
    if (entryId === '10.8') score += 16;
    if (entryId === '10.8' && /荤素|胜食气|肉虽多|合度|蛋白质/.test(context)) score += 6;
  }
  if (/恕|劝人|送命|赴死|牺牲|勿施|不强求|推己/.test(context)) {
    if (entryId === '15.24' || entryId === '12.2') score += 14;
  }
  // 真实关爱 → 抬「仁者爱人 / 己欲立而立人」
  if (/关爱|体贴|关心|关怀|在意|记挂|关照|表达关注/.test(context)) {
    if (entryId === '12.22') score += 20;
    if (entryId === '6.30') score += 16;
    if (entryId === '1.5') score += 8;
  }
  return score;
}

export function isContextFragileEntry(entryId: string): boolean {
  return CONTEXT_FRAGILE_CORPUS_IDS.has(entryId);
}
