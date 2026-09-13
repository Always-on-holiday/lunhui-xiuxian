import type { AdventureState } from "@/lib/events";
import { createLifeTimeline, type LifeTimeline, type TimeSystemRules } from "@/lib/longevity";
import type {
  CycleSecretState,
  DeathState,
  FateMark,
  InheritedMemory,
  LifeInheritance,
} from "@/lib/reincarnation";
import { applyInheritance } from "@/lib/reincarnation";

export type StatKey = "attack" | "defense" | "speed" | "intelligence" | "proficiency";

export type FiveStats = Record<StatKey, number>;
export type BirthStep = "origin" | "root" | "allocation" | "ready";

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
  usedItems?: string[];
  itemMessages?: string[];
};

type RootProfileConfig = Omit<SpiritualRoot, "count" | "name" | "elements"> & {
  nameTemplate: string;
  statBonus: Partial<FiveStats>;
  sideQuestId: string;
};

export type TrialComparisonKey = "initiative" | "offense" | "guard" | "technique";

export type LearnedAbility = {
  id: string;
  name: string;
  grade: string;
  description: string;
};

export type ItemEffect = {
  contextId: string;
  message: string;
  battleBonus?: Partial<Record<TrialComparisonKey, number>>;
  bonusWins?: number;
  forceOutcome?: string;
  checkBonus?: number;
  specialResult?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  consumable: boolean;
  effects: ItemEffect[];
};

export type Origin = {
  id: string;
  name: string;
  description: string;
};

export type HiddenTalent = {
  id: string;
  name: string;
  description: string;
  revealCondition: string;
};

type OriginConfig = Origin & {
  weight: number;
  statBonus: Partial<FiveStats>;
  spiritStones: number;
  startingItems: string[];
  startingCultivationArts?: string[];
  startingCultivationRoll?: Array<{ id: string; weight: number }>;
  startingTechniques?: string[];
  hiddenTalentId?: string;
};

type TrialRules = {
  contextId: string;
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
    stats: VitalRules & {
      minimum: number;
      maximum: number;
      allocationPoints?: number;
      allocationMaximumPerStat?: number;
    };
    elements: string[];
    rootRoll: Array<{ count: number; weight: number }>;
  };
  character: {
    originResultLabel: string;
    originRollLabel: string;
    allocationTitle: string;
    allocationDescription: string;
    allocationRemainingLabel: string;
    allocationConfirmButton: string;
    allocationCompleteText: string;
    birthProgressTitle: string;
    originStepLabel: string;
    rootStepLabel: string;
    allocationStepLabel: string;
    originContinueButton: string;
    rootContinueButton: string;
    earlySidebarText: string;
    rootSummaryLabel: string;
    talentSummaryLabel: string;
    assetsTitle: string;
    spiritStoneLabel: string;
    inventoryTab: string;
    cultivationTab: string;
    techniqueTab: string;
    inventoryEmpty: string;
    cultivationEmpty: string;
    techniqueEmpty: string;
    selectItem: string;
    selectedItem: string;
    itemUseHint: string;
    uselessItemTemplate: string;
    usefulItemTemplate: string;
    unselectedItemTemplate: string;
    origins: OriginConfig[];
    startingCultivationArts: string[];
    startingTechniques: string[];
    cultivationArts: Record<string, LearnedAbility>;
    techniques: Record<string, LearnedAbility>;
    items: Record<string, InventoryItem>;
    hiddenTalents: Record<string, HiddenTalent>;
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
  worldRules: {
    death: {
      title: string;
      summary: string;
      worldContinuesOnPlayerDeath: boolean;
      playerReincarnatesInSameWorld: boolean;
      rewindWhenAllPlayersDead: boolean;
      rewindTarget: string;
    };
    multiplayerTitle: string;
    raids: Array<{
      id: string;
      name: string;
      description: string;
      minimumPlayers: number;
      maximumPlayers: number;
      unlockRealm: string;
      status: string;
    }>;
  };
  timeSystem: TimeSystemRules;
};

export type PrologueLife = {
  version: 1;
  level: number;
  realm: string;
  stats: FiveStats;
  root: SpiritualRoot;
  origin?: Origin;
  spiritStones?: number;
  inventory?: InventoryItem[];
  cultivationArts?: LearnedAbility[];
  techniques?: LearnedAbility[];
  hiddenTalent?: HiddenTalent;
  selectedTrialItemIds?: string[];
  vitalRules?: VitalRules;
  maxHealth: number;
  maxSpirit: number;
  currentHealth: number;
  currentSpirit: number;
  birthText: string;
  mainQuest: Quest;
  sideQuest: Quest;
  sideQuestTriggered: boolean;
  originRoll?: { value: number; maximum: number };
  unspentStatPoints?: number;
  statAllocation?: FiveStats;
  statAllocationFinalized?: boolean;
  prologueStep?: BirthStep;
  training?: TrainingChoice;
  battle?: BattleReport;
  adventure?: AdventureState;
  cycle?: number;
  deathState?: DeathState;
  deathMarks?: FateMark[];
  inheritedMemory?: InheritedMemory;
  inheritance?: LifeInheritance;
  cycleSecret?: CycleSecretState;
  timeline?: LifeTimeline;
  freeActionAttempts?: Record<string, number>;
  freeActionWorldMinutes?: number;
  freeActionFlags?: Record<string, boolean | string | number>;
  freeActionTargetStates?: Record<string, string>;
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

function rollWeightedWithResult<T extends { weight: number }>(options: T[]) {
  const usable = options.filter((item) => item.weight > 0);
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return { option: options[0], roll: 0, maximum: 0 };

  const originalRoll = randomInt(1, totalWeight);
  let roll = originalRoll;
  for (const option of usable) {
    roll -= option.weight;
    if (roll <= 0) return { option, roll: originalRoll, maximum: totalWeight };
  }
  return { option: usable.at(-1), roll: originalRoll, maximum: totalWeight };
}

function rollWeighted<T extends { weight: number }>(options: T[]) {
  return rollWeightedWithResult(options).option;
}

function rollRootCount(options: PrologueConfig["birth"]["rootRoll"]) {
  return rollWeighted(options)?.count ?? 1;
}

function uniqueAbilities(ids: string[], catalog: Record<string, LearnedAbility>) {
  return [...new Set(ids)]
    .map((id) => catalog[id])
    .filter((ability): ability is LearnedAbility => Boolean(ability))
    .map((ability) => ({ ...ability }));
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
      && candidate.character
      && Array.isArray(candidate.character.origins)
      && candidate.character.origins.length > 0
      && candidate.rootProfiles
      && candidate.sideQuests
      && candidate.training
      && Array.isArray(candidate.training.choices)
      && candidate.trial
      && candidate.trial.comparisons
      && candidate.trial.outcomes
      && candidate.worldRules
      && candidate.timeSystem?.lifespan
      && candidate.timeSystem?.costs,
  );
}

export function rollBirth(config: PrologueConfig, inheritance?: LifeInheritance, cycle = 1): PrologueLife {
  const count = rollRootCount(config.birth.rootRoll);
  const profile = config.rootProfiles[String(count)] ?? Object.values(config.rootProfiles)[0];
  if (!profile) throw new Error("序章规则中没有可用的灵根配置。");
  const originResult = rollWeightedWithResult(config.character.origins);
  const originConfig = originResult.option;
  if (!originConfig) throw new Error("序章规则中没有可用的出身配置。");

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
    stats[key] += originConfig.statBonus[key] ?? 0;
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
  const rolledArtId = rollWeighted(originConfig.startingCultivationRoll ?? [])?.id;
  const cultivationArtIds = [
    ...config.character.startingCultivationArts,
    ...(originConfig.startingCultivationArts ?? []),
    ...(rolledArtId ? [rolledArtId] : []),
  ];
  const techniqueIds = [
    ...config.character.startingTechniques,
    ...(originConfig.startingTechniques ?? []),
  ];
  const inventory = originConfig.startingItems
    .map((id) => config.character.items[id])
    .filter((item): item is InventoryItem => Boolean(item))
    .map((item) => ({
      ...item,
      effects: item.effects.map((effect) => ({
        ...effect,
        battleBonus: effect.battleBonus ? { ...effect.battleBonus } : undefined,
      })),
    }));
  const hiddenTalent = originConfig.hiddenTalentId
    ? config.character.hiddenTalents[originConfig.hiddenTalentId]
    : undefined;

  const inheritedLife = applyInheritance({
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
    origin: {
      id: originConfig.id,
      name: originConfig.name,
      description: originConfig.description,
    },
    spiritStones: originConfig.spiritStones,
    inventory,
    cultivationArts: uniqueAbilities(cultivationArtIds, config.character.cultivationArts),
    techniques: uniqueAbilities(techniqueIds, config.character.techniques),
    hiddenTalent: hiddenTalent ? { ...hiddenTalent } : undefined,
    selectedTrialItemIds: [],
    vitalRules,
    ...vitals,
    currentHealth: vitals.maxHealth,
    currentSpirit: vitals.maxSpirit,
    birthText: config.birth.story,
    mainQuest: { ...config.mainQuest },
    sideQuest: { ...sideQuest },
    sideQuestTriggered: false,
    originRoll: { value: originResult.roll, maximum: originResult.maximum },
    unspentStatPoints: config.birth.stats.allocationPoints ?? 5,
    statAllocation: {
      attack: 0,
      defense: 0,
      speed: 0,
      intelligence: 0,
      proficiency: 0,
    },
    statAllocationFinalized: (config.birth.stats.allocationPoints ?? 5) <= 0,
    prologueStep: "origin",
  }, inheritance, cycle);
  return {
    ...inheritedLife,
    timeline: createLifeTimeline(inheritedLife, config.timeSystem),
  };
}

export function currentBirthStep(life: PrologueLife): BirthStep {
  if (life.prologueStep) return life.prologueStep;
  return life.statAllocationFinalized === false ? "origin" : "ready";
}

export function advanceBirthStep(life: PrologueLife) {
  const step = currentBirthStep(life);
  if (step === "origin") return { ...life, prologueStep: "root" as const };
  if (step === "root") {
    return {
      ...life,
      prologueStep: life.statAllocationFinalized ? "ready" as const : "allocation" as const,
    };
  }
  return life;
}

export function adjustBirthStat(
  life: PrologueLife,
  stat: StatKey,
  direction: 1 | -1,
  maximumPerStat = 3,
) {
  if (life.statAllocationFinalized) return life;
  const allocation: FiveStats = {
    attack: life.statAllocation?.attack ?? 0,
    defense: life.statAllocation?.defense ?? 0,
    speed: life.statAllocation?.speed ?? 0,
    intelligence: life.statAllocation?.intelligence ?? 0,
    proficiency: life.statAllocation?.proficiency ?? 0,
  };
  const remaining = life.unspentStatPoints ?? 0;
  if (direction > 0 && (remaining <= 0 || allocation[stat] >= maximumPerStat)) return life;
  if (direction < 0 && allocation[stat] <= 0) return life;

  const adjusted = applyGains(life, { [stat]: direction });
  return {
    ...adjusted,
    unspentStatPoints: remaining - direction,
    statAllocation: { ...allocation, [stat]: allocation[stat] + direction },
  };
}

export function finalizeBirthStats(life: PrologueLife) {
  if ((life.unspentStatPoints ?? 0) > 0) return life;
  return { ...life, statAllocationFinalized: true, prologueStep: "ready" as const };
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

export function itemWorksInContext(item: InventoryItem, contextId: string) {
  return item.quantity > 0 && item.effects.some((effect) => effect.contextId === contextId);
}

export function toggleTrialItem(life: PrologueLife, itemId: string, contextId: string) {
  const item = life.inventory?.find((candidate) => candidate.id === itemId);
  if (!item || !itemWorksInContext(item, contextId)) return life;
  const selected = new Set(life.selectedTrialItemIds ?? []);
  if (selected.has(itemId)) selected.delete(itemId);
  else selected.add(itemId);
  return { ...life, selectedTrialItemIds: [...selected] };
}

export function resolveWoodenTrial(life: PrologueLife, rules: TrialRules): PrologueLife {
  const calculation = rules.calculations;
  const selectedIds = new Set(life.selectedTrialItemIds ?? []);
  const applicableItems = (life.inventory ?? [])
    .map((item) => ({
      item,
      effect: item.effects.find((candidate) => candidate.contextId === rules.contextId),
    }))
    .filter((entry): entry is { item: InventoryItem; effect: ItemEffect } => (
      selectedIds.has(entry.item.id) && entry.item.quantity > 0 && Boolean(entry.effect)
    ));
  const itemBonus: Partial<Record<TrialComparisonKey, number>> = {};
  let bonusWins = 0;
  const forcedOutcomes: BattleReport["outcome"][] = [];
  applicableItems.forEach(({ effect }) => {
    (Object.keys(effect.battleBonus ?? {}) as TrialComparisonKey[]).forEach((key) => {
      itemBonus[key] = (itemBonus[key] ?? 0) + (effect.battleBonus?.[key] ?? 0);
    });
    bonusWins += effect.bonusWins ?? 0;
    if (effect.forceOutcome === "victory" || effect.forceOutcome === "close" || effect.forceOutcome === "defeat") {
      forcedOutcomes.push(effect.forceOutcome);
    }
  });
  const initiative = life.stats.speed
    + Math.floor(life.stats.intelligence / 2)
    + randomInt(calculation.initiativeRandom.min, calculation.initiativeRandom.max)
    + (itemBonus.initiative ?? 0);
  const offense = life.stats.attack
    + Math.floor(life.stats.proficiency / 2)
    + randomInt(calculation.offenseRandom.min, calculation.offenseRandom.max)
    + (itemBonus.offense ?? 0);
  const guard = life.stats.defense
    + Math.floor(life.stats.speed / 3)
    + randomInt(calculation.guardRandom.min, calculation.guardRandom.max)
    + (itemBonus.guard ?? 0);
  const rootBonus = calculation.preferredRootCounts.includes(life.root.count)
    ? calculation.preferredRootBonus
    : calculation.normalRootBonus;
  const technique = life.stats.intelligence
    + Math.floor(life.stats.proficiency / 3)
    + rootBonus
    + randomInt(calculation.techniqueRandom.min, calculation.techniqueRandom.max)
    + (itemBonus.technique ?? 0);

  const values: Record<TrialComparisonKey, number> = { initiative, offense, guard, technique };
  const comparisonKeys: TrialComparisonKey[] = ["initiative", "offense", "guard", "technique"];
  const comparisons = comparisonKeys.map((key) => ({
    label: rules.comparisons[key].label,
    player: values[key],
    enemy: rules.comparisons[key].target,
    verdict: values[key] >= rules.comparisons[key].target ? "占优" : "吃亏",
  }));

  const wins = comparisons.filter((item) => item.player >= item.enemy).length + bonusWins;
  let outcome: BattleReport["outcome"] = wins >= rules.victoryMinimumWins
    ? "victory"
    : wins >= rules.closeMinimumWins ? "close" : "defeat";
  const outcomeRank: Record<BattleReport["outcome"], number> = { defeat: 0, close: 1, victory: 2 };
  forcedOutcomes.forEach((forced) => {
    if (outcomeRank[forced] > outcomeRank[outcome]) outcome = forced;
  });
  const healthLoss = randomInt(rules.healthLoss[outcome].min, rules.healthLoss[outcome].max);
  const spiritLoss = randomInt(rules.spiritLoss.min, rules.spiritLoss.max);
  const battle: BattleReport = {
    outcome,
    comparisons,
    healthAfter: Math.max(1, life.currentHealth - healthLoss),
    spiritAfter: Math.max(0, life.currentSpirit - spiritLoss),
    usedItems: applicableItems.map(({ item }) => item.name),
    itemMessages: applicableItems.map(({ effect }) => effect.message),
    ...rules.outcomes[outcome],
  };

  const next = {
    ...life,
    inventory: (life.inventory ?? []).map((item) => {
      const wasUsed = applicableItems.some((entry) => entry.item.id === item.id);
      if (!wasUsed || !item.consumable) return item;
      return { ...item, quantity: Math.max(0, item.quantity - 1) };
    }),
    selectedTrialItemIds: [],
    currentHealth: battle.healthAfter,
    currentSpirit: battle.spiritAfter,
    battle,
  };

  if (outcome === "defeat") {
    return applyGains(next, rules.defeatBonus);
  }
  return { ...next, level: rules.successLevel };
}
