export type StatKey = "attack" | "defense" | "speed" | "intelligence" | "proficiency";

export type FiveStats = Record<StatKey, number>;

export type TrainingChoice = {
  id: "herbs" | "stones" | "kite";
  title: string;
  description: string;
  risk: string;
  gains: Partial<FiveStats>;
};

export type SpiritualRoot = {
  count: number;
  name: string;
  elements: string[];
  talent: string;
  talentText: string;
  reception: string;
  growth: string;
};

export type Quest = {
  title: string;
  condition: string;
  summary: string;
};

export type BattleComparison = {
  label: string;
  player: number;
  enemy: number;
  verdict: string;
};

export type BattleReport = {
  outcome: "victory" | "close" | "defeat";
  title: string;
  summary: string;
  reward: string;
  comparisons: BattleComparison[];
  healthAfter: number;
  spiritAfter: number;
};

export type PrologueLife = {
  version: 1;
  level: number;
  realm: string;
  stats: FiveStats;
  root: SpiritualRoot;
  maxHealth: number;
  maxSpirit: number;
  currentHealth: number;
  currentSpirit: number;
  birthText: string;
  mainQuest: Quest;
  sideQuest: Quest;
  sideQuestTriggered: boolean;
  training?: TrainingChoice;
  battle?: BattleReport;
};

const ELEMENTS = ["金", "木", "水", "火", "土"];

const STAT_KEYS: StatKey[] = ["attack", "defense", "speed", "intelligence", "proficiency"];

const ROOT_PROFILES = {
  1: {
    talent: "一脉通明",
    talentText: "本命功法更快成形；被追捧时更容易获得师承，也更容易成为众矢之的。",
    reception: "测灵石只亮起一道纯光。族老们纷纷起身，奉承声几乎盖过了钟鸣。",
    growth: "前期顺遂 · 上限不独占",
  },
  2: {
    talent: "两仪相济",
    talentText: "两种灵气可以互相补足，首次陷入劣势时获得一次小幅反击。",
    reception: "两色灵光相生相绕。执事点头，把你的名字写进了内堂候选。",
    growth: "成形较快 · 路线灵活",
  },
  3: {
    talent: "三才并进",
    talentText: "修炼、见识和实战能够互相带动，属性成长更加均衡。",
    reception: "三道灵光平稳升起。没人惊呼，但负责记录的老者多看了你一眼。",
    growth: "稳步成长 · 不易偏科",
  },
  4: {
    talent: "四象借势",
    talentText: "更容易利用环境与克制，每段旅程可将一次坏结果缓和为普通结果。",
    reception: "四道灵光明灭不定。执事说资质普通，却又嘱咐你别荒废这份通变。",
    growth: "前期稍慢 · 奇遇更多",
  },
  5: {
    talent: "五行归藏",
    talentText: "开局修炼较慢；每次突破大境界都会额外沉淀成长，并开启五行专属支线。",
    reception: "五色微光挤在石面上，旁边传来一声嗤笑。只有角落里的扫地老人没有笑。",
    growth: "前期受困 · 后劲极强",
  },
} as const;

const SIDE_QUESTS: Record<number, Quest> = {
  1: {
    title: "盛名之下",
    condition: "天灵根 · 已完成测灵",
    summary: "回应众人的奉承，或记住那个始终没有开口的人。",
  },
  2: {
    title: "相生旧卷",
    condition: "双灵根 · 已完成测灵",
    summary: "藏书阁里有一卷无人能读通的两仪残页。",
  },
  3: {
    title: "药篓缺角",
    condition: "三灵根 · 智力达到 9",
    summary: "药婆的旧篓里，总会多出一味不该出现的药草。",
  },
  4: {
    title: "四时杂役",
    condition: "四灵根 · 速度达到 10",
    summary: "四座偏院同时缺人，也许杂事本身就是一场修行。",
  },
  5: {
    title: "井边的五行石",
    condition: "五灵根 · 听见族人嘲讽",
    summary: "所有人都走后，枯井底下却亮起了与你相同的五色微光。",
  },
};

export const TRAINING_CHOICES: TrainingChoice[] = [
  {
    id: "herbs",
    title: "替药婆辨草",
    description: "从气味和叶脉里记住灵药，准备得更周全。",
    risk: "风险低 · 智力、熟练度 +1",
    gains: { intelligence: 1, proficiency: 1 },
  },
  {
    id: "stones",
    title: "随父亲搬青石",
    description: "日复一日打熬筋骨，以最笨的办法攒下底子。",
    risk: "风险低 · 攻击、防御 +1",
    gains: { attack: 1, defense: 1 },
  },
  {
    id: "kite",
    title: "追逐后山纸鸢",
    description: "在乱石和山风间练脚步，也学会判断风向。",
    risk: "风险中 · 速度 +2",
    gains: { speed: 2 },
  },
];

function randomInt(min: number, max: number) {
  const range = max - min + 1;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return min + (value[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}

function shuffledElements(count: number) {
  const values = [...ELEMENTS];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.slice(0, count);
}

function rollRootCount() {
  const roll = randomInt(1, 100);
  if (roll <= 8) return 1;
  if (roll <= 25) return 2;
  if (roll <= 55) return 3;
  if (roll <= 82) return 4;
  return 5;
}

function rootName(count: number, elements: string[]) {
  if (count === 1) return `${elements[0]}系天灵根`;
  if (count === 2) return `${elements.join("·")}双灵根`;
  if (count === 3) return `${elements.join("·")}三灵根`;
  if (count === 4) return `${elements.join("·")}四灵根`;
  return "金·木·水·火·土五灵根";
}

function deriveVitals(stats: FiveStats) {
  return {
    maxHealth: 34 + stats.defense * 3,
    maxSpirit: 18 + stats.intelligence * 2 + stats.proficiency,
  };
}

function applyGains(life: PrologueLife, gains: Partial<FiveStats>) {
  const stats = { ...life.stats };
  STAT_KEYS.forEach((key) => {
    stats[key] += gains[key] ?? 0;
  });
  const vitals = deriveVitals(stats);
  return {
    ...life,
    stats,
    ...vitals,
    currentHealth: Math.min(vitals.maxHealth, life.currentHealth + (vitals.maxHealth - life.maxHealth)),
    currentSpirit: Math.min(vitals.maxSpirit, life.currentSpirit + (vitals.maxSpirit - life.maxSpirit)),
  };
}

export function rollBirth(): PrologueLife {
  const count = rollRootCount();
  const elements = shuffledElements(count);
  const profile = ROOT_PROFILES[count as keyof typeof ROOT_PROFILES];
  const stats: FiveStats = {
    attack: randomInt(8, 11),
    defense: randomInt(8, 11),
    speed: randomInt(8, 11),
    intelligence: randomInt(8, 11),
    proficiency: randomInt(8, 11),
  };

  if (count === 1) stats.intelligence += 1;
  if (count === 2) stats.attack += 1;
  if (count === 3) stats.defense += 1;
  if (count === 4) stats.speed += 1;
  if (count === 5) stats.proficiency -= 1;

  const vitals = deriveVitals(stats);
  return {
    version: 1,
    level: 1,
    realm: "锻体初期",
    stats,
    root: {
      count,
      name: rootName(count, elements),
      elements,
      ...profile,
    },
    ...vitals,
    currentHealth: vitals.maxHealth,
    currentSpirit: vitals.maxSpirit,
    birthText: "你出生在青冥洲北境的一户凡人家中。第七年，山门测灵舟停在了村口。",
    mainQuest: {
      title: "锻体境主线 · 叩开仙门",
      condition: "突破练气前必须完成",
      summary: "完成一次童年修行，并通过青崖门的木傀试炼。",
    },
    sideQuest: SIDE_QUESTS[count],
    sideQuestTriggered: false,
  };
}

export function triggerSideQuest(life: PrologueLife) {
  if (life.sideQuestTriggered || !canTriggerSideQuest(life)) return life;
  const bonusByRoot: Record<number, Partial<FiveStats>> = {
    1: { intelligence: 1 },
    2: { attack: 1 },
    3: { proficiency: 1 },
    4: { speed: 1 },
    5: { defense: 1 },
  };
  return {
    ...applyGains(life, bonusByRoot[life.root.count]),
    sideQuestTriggered: true,
  };
}

export function canTriggerSideQuest(life: PrologueLife) {
  if (life.root.count === 3) return life.stats.intelligence >= 9;
  if (life.root.count === 4) return life.stats.speed >= 10;
  return true;
}

export function chooseTraining(life: PrologueLife, choiceId: TrainingChoice["id"]) {
  const choice = TRAINING_CHOICES.find((item) => item.id === choiceId);
  if (!choice || life.training) return life;
  return {
    ...applyGains(life, choice.gains),
    training: choice,
  };
}

export function resolveWoodenTrial(life: PrologueLife): PrologueLife {
  const initiative = life.stats.speed + Math.floor(life.stats.intelligence / 2) + randomInt(0, 3);
  const offense = life.stats.attack + Math.floor(life.stats.proficiency / 2) + randomInt(1, 4);
  const guard = life.stats.defense + Math.floor(life.stats.speed / 3) + randomInt(1, 4);
  const technique = life.stats.intelligence + Math.floor(life.stats.proficiency / 3)
    + (life.root.count === 1 || life.root.count === 5 ? 2 : 1) + randomInt(0, 3);

  const raw = [
    { label: "抢占先手", player: initiative, enemy: 14 },
    { label: "正面破势", player: offense, enemy: 15 },
    { label: "承受反击", player: guard, enemy: 14 },
    { label: "灵根应变", player: technique, enemy: 15 },
  ];
  const wins = raw.filter((item) => item.player >= item.enemy).length;
  const outcome: BattleReport["outcome"] = wins >= 3 ? "victory" : wins === 2 ? "close" : "defeat";
  const healthLoss = outcome === "victory" ? randomInt(2, 6) : outcome === "close" ? randomInt(7, 12) : randomInt(13, 18);
  const spiritLoss = randomInt(5, 9);
  const comparison: BattleComparison[] = raw.map((item) => ({
    ...item,
    verdict: item.player >= item.enemy ? "占优" : "吃亏",
  }));

  const resultText = {
    victory: {
      title: "胜利 · 稳稳过关",
      summary: "木傀被你压回阵眼。过程不算轻松，但局势始终在掌握之中。",
      reward: "获得：入门木牌、修为 +1",
    },
    close: {
      title: "险胜 · 带伤入门",
      summary: "最后一击几乎同时落下。你扶着木傀站稳，终于等到执事点头。",
      reward: "获得：入门木牌、旧伤标记、修为 +1",
    },
    defeat: {
      title: "落败 · 尚可再战",
      summary: "木傀将你逼出阵外。序章不会致死，你记住了它的起手式。",
      reward: "获得：熟练度 +1；调息后可以重试",
    },
  }[outcome];

  const battle: BattleReport = {
    outcome,
    comparisons: comparison,
    healthAfter: Math.max(1, life.currentHealth - healthLoss),
    spiritAfter: Math.max(0, life.currentSpirit - spiritLoss),
    ...resultText,
  };

  const next = {
    ...life,
    currentHealth: battle.healthAfter,
    currentSpirit: battle.spiritAfter,
    battle,
  };

  if (outcome === "defeat") {
    return applyGains(next, { proficiency: 1 });
  }
  return { ...next, level: 2 };
}
