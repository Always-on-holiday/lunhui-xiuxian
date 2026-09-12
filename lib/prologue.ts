export type StatKey = "attack" | "defense" | "speed" | "intelligence" | "proficiency";

export type FiveStats = Record<StatKey, number>;

export type RandomRange = {
  min: number;
  max: number;
};

export type VitalRules = {
  healthBase: number;
  healthPerDefense: number;
  spiritBase: number;
  spiritPerIntelligence: number;
  spiritPerProficiency: number;
};

export type TrainingChoice = {
  id: string;
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
  unlock?: { stat: StatKey; minimum: number } | null;
  bonus?: Partial<FiveStats>;
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

type RootProfileConfig = Omit<SpiritualRoot, "count" | "name" | "elements"> & {
  nameTemplate: string;
  statBonus: Partial<FiveStats>;
  sideQuestId: string;
};

type TrialComparisonKey = "initiative" | "offense" | "guard" | "technique";

type TrialRules = {
  title: string;
  description: string;
  riskText: string;
  startButton: string;
  retryButton: string;
  completionText: string;
  windowTitle: string;
  windowBadge: string;
  emptyTitle: string;
  emptyText: string;
  calculations: {
    initiativeRandom: RandomRange;
    offenseRandom: RandomRange;
    guardRandom: RandomRange;
    techniqueRandom: RandomRange;
    preferredRootCounts: number[];
    preferredRootBonus: number;
    normalRootBonus: number;
  };
  comparisons: Record<TrialComparisonKey, { label: string; target: number }>;
  victoryMinimumWins: number;
  closeMinimumWins: number;
  healthLoss: Record<BattleReport["outcome"], RandomRange>;
  spiritLoss: RandomRange;
  outcomes: Record<BattleReport["outcome"], Pick<BattleReport, "title" | "summary" | "reward">>;
  defeatBonus: Partial<FiveStats>;
  successLevel: number;
};

export type PrologueConfig = {
  meta: { version: number; title: string };
  intro: {
    description: string;
    flowLabel: string;
    flowText: string;
    rollButton: string;
  };
  birth: {
    level: number;
    realm: string;
    story: string;
    stats: VitalRules & { minimum: number; maximum: number };
    elements: string[];
    rootRoll: Array<{ count: number; weight: number }>;
  };
  mainQuest: Quest;
  rootProfiles: Record<string, RootProfileConfig>;
  sideQuests: Record<string, Quest>;
  training: {
    eyebrow: string;
    title: string;
    choices: TrainingChoice[];
  };
  trial: TrialRules;
};

export type PrologueLife = {
  version: 1;
  level: number;
  realm: string;
  stats: FiveStats;
  root: SpiritualRoot;
  vitalRules?: VitalRules;
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

const STAT_KEYS: StatKey[] = ["attack", "defense", "speed", "intelligence", "proficiency"];

const LEGACY_VITAL_RULES: VitalRules = {
  healthBase: 34,
  healthPerDefense: 3,
  spiritBase: 18,
  spiritPerIntelligence: 2,
  spiritPerProficiency: 1,
};

const LEGACY_SIDE_BONUS: Record<number, Partial<FiveStats>> = {
  1: { intelligence: 1 },
  2: { attack: 1 },
  3: { proficiency: 1 },
  4: { speed: 1 },
  5: { defense: 1 },
};

function randomInt(min: number, max: number) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  const range = upper - lower + 1;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return lower + (value[0] % range);
  }
  return lower + Math.floor(Math.random() * range);
}

function shuffledElements(elements: string[], count: number) {
  const values = [...elements];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.slice(0, count);
}

function rollRootCount(options: PrologueConfig["birth"]["rootRoll"]) {
  const usable = options.filter((item) => item.weight > 0);
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return options[0]?.count ?? 1;

  let roll = randomInt(1, totalWeight);
  for (const option of usable) {
    roll -= option.weight;
    if (roll <= 0) return option.count;
  }
  return usable.at(-1)?.count ?? 1;
}

function rootName(template: string, elements: string[]) {
  return template.replaceAll("{elements}", elements.join("·"));
}

function deriveVitals(stats: FiveStats, rules: VitalRules) {
  return {
    maxHealth: rules.healthBase + stats.defense * rules.healthPerDefense,
    maxSpirit: rules.spiritBase
      + stats.intelligence * rules.spiritPerIntelligence
      + stats.proficiency * rules.spiritPerProficiency,
  };
}

function applyGains(life: PrologueLife, gains: Partial<FiveStats>) {
  const stats = { ...life.stats };
  STAT_KEYS.forEach((key) => {
    stats[key] += gains[key] ?? 0;
  });
  const vitals = deriveVitals(stats, life.vitalRules ?? LEGACY_VITAL_RULES);
  return {
    ...life,
    stats,
    ...vitals,
    currentHealth: Math.min(vitals.maxHealth, life.currentHealth + (vitals.maxHealth - life.maxHealth)),
    currentSpirit: Math.min(vitals.maxSpirit, life.currentSpirit + (vitals.maxSpirit - life.maxSpirit)),
  };
}

export function isPrologueConfig(value: unknown): value is PrologueConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PrologueConfig>;
  return Boolean(
    candidate.birth
      && Array.isArray(candidate.birth.elements)
      && candidate.birth.elements.length > 0
      && Array.isArray(candidate.birth.rootRoll)
      && candidate.birth.rootRoll.length > 0
      && candidate.rootProfiles
      && candidate.sideQuests
      && candidate.training
      && Array.isArray(candidate.training.choices)
      && candidate.trial
      && candidate.trial.comparisons
      && candidate.trial.outcomes,
  );
}

export function rollBirth(config: PrologueConfig): PrologueLife {
  const count = rollRootCount(config.birth.rootRoll);
  const profile = config.rootProfiles[String(count)] ?? Object.values(config.rootProfiles)[0];
  if (!profile) throw new Error("序章规则中没有可用的灵根配置。");

  const elements = shuffledElements(config.birth.elements, count);
  const stats: FiveStats = {
    attack: randomInt(config.birth.stats.minimum, config.birth.stats.maximum),
    defense: randomInt(config.birth.stats.minimum, config.birth.stats.maximum),
    speed: randomInt(config.birth.stats.minimum, config.birth.stats.maximum),
    intelligence: randomInt(config.birth.stats.minimum, config.birth.stats.maximum),
    proficiency: randomInt(config.birth.stats.minimum, config.birth.stats.maximum),
  };

  STAT_KEYS.forEach((key) => {
    stats[key] += profile.statBonus[key] ?? 0;
  });

  const vitalRules: VitalRules = {
    healthBase: config.birth.stats.healthBase,
    healthPerDefense: config.birth.stats.healthPerDefense,
    spiritBase: config.birth.stats.spiritBase,
    spiritPerIntelligence: config.birth.stats.spiritPerIntelligence,
    spiritPerProficiency: config.birth.stats.spiritPerProficiency,
  };
  const vitals = deriveVitals(stats, vitalRules);
  const sideQuest = config.sideQuests[profile.sideQuestId] ?? Object.values(config.sideQuests)[0];
  if (!sideQuest) throw new Error("序章规则中没有可用的支线配置。");

  return {
    version: 1,
    level: config.birth.level,
    realm: config.birth.realm,
    stats,
    root: {
      count,
      name: rootName(profile.nameTemplate, elements),
      elements,
      talent: profile.talent,
      talentText: profile.talentText,
      reception: profile.reception,
      growth: profile.growth,
    },
    vitalRules,
    ...vitals,
    currentHealth: vitals.maxHealth,
    currentSpirit: vitals.maxSpirit,
    birthText: config.birth.story,
    mainQuest: { ...config.mainQuest },
    sideQuest: { ...sideQuest },
    sideQuestTriggered: false,
  };
}

export function triggerSideQuest(life: PrologueLife) {
  if (life.sideQuestTriggered || !canTriggerSideQuest(life)) return life;
  const bonus = life.sideQuest.bonus ?? LEGACY_SIDE_BONUS[life.root.count] ?? {};
  return {
    ...applyGains(life, bonus),
    sideQuestTriggered: true,
  };
}

export function canTriggerSideQuest(life: PrologueLife) {
  if (life.sideQuest.unlock) {
    return life.stats[life.sideQuest.unlock.stat] >= life.sideQuest.unlock.minimum;
  }
  if (life.sideQuest.unlock === undefined) {
    if (life.root.count === 3) return life.stats.intelligence >= 9;
    if (life.root.count === 4) return life.stats.speed >= 10;
  }
  return true;
}

export function chooseTraining(life: PrologueLife, choiceId: string, choices: TrainingChoice[]) {
  const choice = choices.find((item) => item.id === choiceId);
  if (!choice || life.training) return life;
  return {
    ...applyGains(life, choice.gains),
    training: choice,
  };
}

export function resolveWoodenTrial(life: PrologueLife, rules: TrialRules): PrologueLife {
  const calculation = rules.calculations;
  const initiative = life.stats.speed
    + Math.floor(life.stats.intelligence / 2)
    + randomInt(calculation.initiativeRandom.min, calculation.initiativeRandom.max);
  const offense = life.stats.attack
    + Math.floor(life.stats.proficiency / 2)
    + randomInt(calculation.offenseRandom.min, calculation.offenseRandom.max);
  const guard = life.stats.defense
    + Math.floor(life.stats.speed / 3)
    + randomInt(calculation.guardRandom.min, calculation.guardRandom.max);
  const rootBonus = calculation.preferredRootCounts.includes(life.root.count)
    ? calculation.preferredRootBonus
    : calculation.normalRootBonus;
  const technique = life.stats.intelligence
    + Math.floor(life.stats.proficiency / 3)
    + rootBonus
    + randomInt(calculation.techniqueRandom.min, calculation.techniqueRandom.max);

  const values: Record<TrialComparisonKey, number> = { initiative, offense, guard, technique };
  const comparisonKeys: TrialComparisonKey[] = ["initiative", "offense", "guard", "technique"];
  const comparisons = comparisonKeys.map((key) => ({
    label: rules.comparisons[key].label,
    player: values[key],
    enemy: rules.comparisons[key].target,
    verdict: values[key] >= rules.comparisons[key].target ? "占优" : "吃亏",
  }));

  const wins = comparisons.filter((item) => item.player >= item.enemy).length;
  const outcome: BattleReport["outcome"] = wins >= rules.victoryMinimumWins
    ? "victory"
    : wins >= rules.closeMinimumWins ? "close" : "defeat";
  const healthLoss = randomInt(rules.healthLoss[outcome].min, rules.healthLoss[outcome].max);
  const spiritLoss = randomInt(rules.spiritLoss.min, rules.spiritLoss.max);
  const battle: BattleReport = {
    outcome,
    comparisons,
    healthAfter: Math.max(1, life.currentHealth - healthLoss),
    spiritAfter: Math.max(0, life.currentSpirit - spiritLoss),
    ...rules.outcomes[outcome],
  };

  const next = {
    ...life,
    currentHealth: battle.healthAfter,
    currentSpirit: battle.spiritAfter,
    battle,
  };

  if (outcome === "defeat") {
    return applyGains(next, rules.defeatBonus);
  }
  return { ...next, level: rules.successLevel };
}
