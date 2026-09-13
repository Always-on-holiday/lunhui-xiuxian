import type {
  FiveStats,
  InventoryItem,
  LearnedAbility,
  PrologueLife,
  StatKey,
} from "@/lib/prologue";

export type EventOutcomeKey = "criticalFailure" | "failure" | "success" | "criticalSuccess";

type Requirement = {
  type: "spiritStones" | "flag" | "cycle" | "cultivationArt" | "item" | "memory";
  minimum?: number;
  id?: string;
  value?: boolean;
};

type EventEffect = {
  type: "health" | "spirit" | "spiritStones" | "stat" | "item" | "flag" | "level";
  operation: "add" | "set";
  value?: number | boolean;
  stat?: StatKey;
  id?: string;
  quantity?: number;
};

type EventOutcome = {
  text: string;
  effects: EventEffect[];
};

type EventModifierCondition = {
  originId?: string;
  hiddenTalentId?: string;
  rootCount?: number;
  rootElement?: string;
};

type EventModifier = {
  when: EventModifierCondition;
  difficultyDelta?: number;
  checkBonus?: number;
  forceOutcome?: EventOutcomeKey;
  preview?: string;
  hidden?: boolean;
};

export type EventChoice = {
  id: string;
  text: string;
  requirements?: Requirement[];
  costs?: EventEffect[];
  risk: {
    grade: "none" | "low" | "medium" | "high" | "extreme";
    primaryStat: StatKey | null;
    failureHint: string;
  };
  resolution: {
    mode: "fixed" | "check";
    stat?: StatKey;
    difficulty?: number;
    contextId?: string;
  };
  modifiers?: EventModifier[];
  outcome?: EventOutcome;
  outcomes?: Record<EventOutcomeKey, EventOutcome>;
};

export type RandomEvent = {
  id: string;
  title: string;
  levelRange: [number, number];
  weight: number;
  scope: "player" | "room";
  repeatPolicy: "once_per_life" | "repeatable";
  tags: string[];
  intro: string;
  choices: EventChoice[];
};

export type EventItemDefinition = Omit<InventoryItem, "quantity" | "effects"> & {
  effects: Array<{
    contextId: string;
    message: string;
    checkBonus?: number;
    forceOutcome?: EventOutcomeKey;
    specialResult?: string;
  }>;
};

export type MainlineMilestone = {
  id: string;
  order: number;
  title: string;
  trigger: { type: "life_start" | "flag" | "random_events_resolved"; id?: string; value?: boolean; count?: number };
  setLevel: number;
  guidance: string;
  completionFlag: string;
};

export type EventLibraryConfig = {
  meta: { version: number; stageId: number; title: string; status: string; notes: string };
  stage: {
    name: string;
    realm: string;
    levelRange: [number, number];
    randomEventPoolSize: number;
    randomEncountersPerLife: number;
    sideQuestsEnabled: boolean;
    completion: { requiredMainlineId: string; setLevel: number; nextStageHint: string };
  };
  display: {
    mode: "single_page_scene";
    replaceCurrentSceneAfterResolution: boolean;
    sendResolvedSceneToHistory: boolean;
    showRiskBeforeChoice: boolean;
    showExactDifficulty: boolean;
    showCalculationInSideWindow: boolean;
  };
  statLabels: Record<StatKey, string>;
  riskGrades: Record<EventChoice["risk"]["grade"], { label: string; difficulty: number | null }>;
  mainlineProgression: MainlineMilestone[];
  itemDefinitions: Record<string, EventItemDefinition>;
  randomEvents: RandomEvent[];
};

export type EventEngineConfig = {
  engine: {
    draw: {
      persistBeforeDisplay: boolean;
      preventRefreshReroll: boolean;
      unseenWeightMultiplier: number;
      recentEventCooldown: number;
      minimumAvailablePool: number;
    };
    check: {
      randomMinimum: number;
      randomMaximum: number;
      formula: string;
      outcomeByMargin: Array<{ result: EventOutcomeKey; minimum?: number; maximum?: number }>;
    };
  };
};

export type EventHistoryEntry = {
  resolutionId: string;
  eventId: string;
  title: string;
  choiceText: string;
  outcome: EventOutcomeKey | "fixed";
  resultText: string;
  effectSummaries?: string[];
};

export type EventCalculation = {
  statLabel: string;
  statValue: number;
  cultivationBonus: number;
  techniqueBonus: number;
  modifierBonus: number;
  itemBonus: number;
  randomRoll: number;
  total: number;
  difficulty: number;
  margin: number;
};

export type EventResolution = EventHistoryEntry & {
  itemMessages: string[];
  uselessItemNames: string[];
  effectSummaries: string[];
  calculation?: EventCalculation;
};

export type AdventureState = {
  version: 1;
  stageId: number;
  stageName: string;
  resolvedCount: number;
  currentEventId: string | null;
  currentDrawId: string | null;
  completedEventIds: string[];
  recentEventIds: string[];
  selectedItemIds: string[];
  flags: Record<string, boolean>;
  history: EventHistoryEntry[];
  lastResolution?: EventResolution;
  stageComplete: boolean;
};

const DEFAULT_ENGINE: EventEngineConfig["engine"] = {
  draw: {
    persistBeforeDisplay: true,
    preventRefreshReroll: true,
    unseenWeightMultiplier: 2.5,
    recentEventCooldown: 4,
    minimumAvailablePool: 4,
  },
  check: {
    randomMinimum: 0,
    randomMaximum: 5,
    formula: "stat + cultivationBonus + techniqueBonus + itemBonus + random",
    outcomeByMargin: [
      { result: "criticalFailure", maximum: -3 },
      { result: "failure", minimum: -2, maximum: -1 },
      { result: "success", minimum: 0, maximum: 2 },
      { result: "criticalSuccess", minimum: 3 },
    ],
  },
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

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function weightedEvent(events: RandomEvent[], adventure: AdventureState, engine: EventEngineConfig["engine"]) {
  const recent = new Set(adventure.recentEventIds.slice(-engine.draw.recentEventCooldown));
  const completed = new Set(adventure.completedEventIds);
  const weighted = events.map((event) => {
    let weight = Math.max(0, event.weight);
    if (!completed.has(event.id)) weight *= engine.draw.unseenWeightMultiplier;
    if (recent.has(event.id)) weight = 0;
    return { event, weight };
  });
  const usable = weighted.filter((entry) => entry.weight > 0);
  if (usable.length === 0) return events[0];
  const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of usable) {
    roll -= entry.weight;
    if (roll <= 0) return entry.event;
  }
  return usable.at(-1)?.event;
}

function eligibleEvents(life: PrologueLife, config: EventLibraryConfig, adventure: AdventureState) {
  const completed = new Set(adventure.completedEventIds);
  const inRange = config.randomEvents.filter((event) => (
    life.level >= event.levelRange[0]
      && life.level <= event.levelRange[1]
      && (event.repeatPolicy === "repeatable" || !completed.has(event.id))
  ));
  if (inRange.length > 0) return inRange;
  return config.randomEvents.filter((event) => event.repeatPolicy === "repeatable" || !completed.has(event.id));
}

function drawNextEvent(life: PrologueLife, config: EventLibraryConfig, adventure: AdventureState, engine: EventEngineConfig["engine"]) {
  if (adventure.resolvedCount >= config.stage.randomEncountersPerLife) {
    return { ...adventure, currentEventId: null, currentDrawId: null, stageComplete: true, selectedItemIds: [] };
  }
  const nextEvent = weightedEvent(eligibleEvents(life, config, adventure), adventure, engine);
  return {
    ...adventure,
    currentEventId: nextEvent?.id ?? null,
    currentDrawId: nextEvent ? makeId() : null,
    selectedItemIds: [],
    lastResolution: undefined,
    stageComplete: !nextEvent,
  };
}

export function isEventLibraryConfig(value: unknown): value is EventLibraryConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EventLibraryConfig>;
  return Boolean(
    candidate.stage
      && Array.isArray(candidate.stage.levelRange)
      && candidate.display?.mode === "single_page_scene"
      && Array.isArray(candidate.mainlineProgression)
      && candidate.itemDefinitions
      && Array.isArray(candidate.randomEvents)
      && candidate.randomEvents.length > 0,
  );
}

export function isEventEngineConfig(value: unknown): value is EventEngineConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EventEngineConfig>;
  return Boolean(candidate.engine?.draw && candidate.engine?.check);
}

export function startVillageAdventure(
  life: PrologueLife,
  config: EventLibraryConfig,
  engineConfig?: EventEngineConfig,
) {
  if (life.adventure) return life;
  const adventure: AdventureState = {
    version: 1,
    stageId: config.meta.stageId,
    stageName: config.stage.name,
    resolvedCount: 0,
    currentEventId: null,
    currentDrawId: null,
    completedEventIds: [],
    recentEventIds: [],
    selectedItemIds: [],
    flags: {
      main_birth_complete: true,
      main_trial_complete: true,
      ...(life.cycleSecret?.flag ? { [life.cycleSecret.flag]: true } : {}),
    },
    history: [],
    stageComplete: false,
  };
  const nextLife = { ...life, realm: config.stage.realm, adventure };
  return { ...nextLife, adventure: drawNextEvent(nextLife, config, adventure, engineConfig?.engine ?? DEFAULT_ENGINE) };
}

export function currentRandomEvent(life: PrologueLife, config: EventLibraryConfig) {
  const id = life.adventure?.currentEventId;
  return id ? config.randomEvents.find((event) => event.id === id) ?? null : null;
}

export function currentMainline(config: EventLibraryConfig, adventure?: AdventureState) {
  const resolved = adventure?.resolvedCount ?? 0;
  return config.mainlineProgression.find((milestone) => (
    milestone.trigger.type === "random_events_resolved" && (milestone.trigger.count ?? 0) > resolved
  )) ?? config.mainlineProgression.at(-1) ?? null;
}

export function choiceRequirementMessage(choice: EventChoice, life: PrologueLife) {
  for (const requirement of choice.requirements ?? []) {
    if (requirement.type === "spiritStones" && (life.spiritStones ?? 0) < (requirement.minimum ?? 0)) {
      return `需要至少 ${requirement.minimum ?? 0} 块灵石`;
    }
    if (requirement.type === "flag" && life.adventure?.flags[requirement.id ?? ""] !== requirement.value) {
      return "尚未满足事件条件";
    }
    if (requirement.type === "cycle" && (life.cycle ?? 1) < (requirement.minimum ?? 1)) {
      return `需要进入第 ${requirement.minimum ?? 1} 世`;
    }
    if (requirement.type === "cultivationArt" && !life.cultivationArts?.some((art) => art.id === requirement.id)) {
      return "尚未继承所需功法";
    }
    if (requirement.type === "item" && !life.inventory?.some((item) => item.id === requirement.id && item.quantity >= (requirement.minimum ?? 1))) {
      return "缺少所需道具";
    }
    if (requirement.type === "memory" && life.inheritedMemory?.id !== requirement.id) {
      return "前世记忆尚未苏醒";
    }
  }
  return "";
}

export function toggleEventItem(life: PrologueLife, itemId: string) {
  if (!life.adventure || life.adventure.lastResolution) return life;
  const item = life.inventory?.find((candidate) => candidate.id === itemId && candidate.quantity > 0);
  if (!item) return life;
  const selected = new Set(life.adventure.selectedItemIds);
  if (selected.has(itemId)) selected.delete(itemId);
  else selected.add(itemId);
  return { ...life, adventure: { ...life.adventure, selectedItemIds: [...selected] } };
}

function conditionMatches(condition: EventModifierCondition, life: PrologueLife) {
  if (condition.originId && life.origin?.id !== condition.originId) return false;
  if (condition.hiddenTalentId && life.hiddenTalent?.id !== condition.hiddenTalentId) return false;
  if (condition.rootCount !== undefined && life.root.count !== condition.rootCount) return false;
  if (condition.rootElement && !life.root.elements.includes(condition.rootElement)) return false;
  return true;
}

function abilityBonus(abilities: LearnedAbility[] | undefined, cultivation: boolean) {
  if (!abilities?.length) return 0;
  if (!cultivation) return 1;
  return abilities.some((ability) => ability.grade.includes("中")) ? 2 : 1;
}

function resultByMargin(margin: number, engine: EventEngineConfig["engine"]): EventOutcomeKey {
  return engine.check.outcomeByMargin.find((entry) => (
    (entry.minimum === undefined || margin >= entry.minimum)
      && (entry.maximum === undefined || margin <= entry.maximum)
  ))?.result ?? (margin >= 0 ? "success" : "failure");
}

function effectSummary(effect: EventEffect, config: EventLibraryConfig) {
  const amount = typeof effect.value === "number" ? effect.value : 0;
  const signed = amount > 0 ? `+${amount}` : `${amount}`;
  if (effect.type === "health") return `气血 ${signed}`;
  if (effect.type === "spirit") return `灵力 ${signed}`;
  if (effect.type === "spiritStones") return `灵石 ${signed}`;
  if (effect.type === "stat" && effect.stat) return `${config.statLabels[effect.stat]} ${signed}`;
  if (effect.type === "item" && effect.id) return `获得「${config.itemDefinitions[effect.id]?.name ?? effect.id}」×${effect.quantity ?? 1}`;
  if (effect.type === "level") return `等级提升至 ${amount}`;
  return "";
}

function applyEffects(life: PrologueLife, effects: EventEffect[], config: EventLibraryConfig) {
  let stats: FiveStats = { ...life.stats };
  let currentHealth = life.currentHealth;
  let currentSpirit = life.currentSpirit;
  let spiritStones = life.spiritStones ?? 0;
  let level = life.level;
  let inventory = [...(life.inventory ?? [])].map((item) => ({ ...item, effects: item.effects.map((effect) => ({ ...effect })) }));
  const flags = { ...(life.adventure?.flags ?? {}) };

  for (const effect of effects) {
    if (effect.type === "health" && typeof effect.value === "number") {
      currentHealth = effect.operation === "set" ? effect.value : currentHealth + effect.value;
    } else if (effect.type === "spirit" && typeof effect.value === "number") {
      currentSpirit = effect.operation === "set" ? effect.value : currentSpirit + effect.value;
    } else if (effect.type === "spiritStones" && typeof effect.value === "number") {
      spiritStones = effect.operation === "set" ? effect.value : spiritStones + effect.value;
    } else if (effect.type === "level" && typeof effect.value === "number") {
      level = effect.operation === "set" ? effect.value : level + effect.value;
    } else if (effect.type === "stat" && effect.stat && typeof effect.value === "number") {
      stats = { ...stats, [effect.stat]: effect.operation === "set" ? effect.value : stats[effect.stat] + effect.value };
    } else if (effect.type === "flag" && effect.id && typeof effect.value === "boolean") {
      flags[effect.id] = effect.value;
    } else if (effect.type === "item" && effect.id) {
      const quantity = effect.quantity ?? (typeof effect.value === "number" ? effect.value : 1);
      const existing = inventory.find((item) => item.id === effect.id);
      if (existing) {
        inventory = inventory.map((item) => item.id === effect.id ? { ...item, quantity: Math.max(0, item.quantity + quantity) } : item);
      } else {
        const definition = config.itemDefinitions[effect.id];
        if (definition) inventory.push({ ...definition, quantity: Math.max(0, quantity), effects: definition.effects.map((itemEffect) => ({ ...itemEffect })) });
      }
    }
  }

  const rules = life.vitalRules;
  const maxHealth = rules
    ? rules.healthBase + stats.defense * rules.healthPerDefense
    : life.maxHealth + (stats.defense - life.stats.defense) * 3;
  const maxSpirit = rules
    ? rules.spiritBase + stats.intelligence * rules.spiritPerIntelligence + stats.proficiency * rules.spiritPerProficiency
    : life.maxSpirit + (stats.intelligence - life.stats.intelligence) * 2 + (stats.proficiency - life.stats.proficiency);

  return {
    ...life,
    level,
    stats,
    maxHealth,
    maxSpirit,
    currentHealth: Math.max(0, Math.min(maxHealth, currentHealth + Math.max(0, maxHealth - life.maxHealth))),
    currentSpirit: Math.max(0, Math.min(maxSpirit, currentSpirit + Math.max(0, maxSpirit - life.maxSpirit))),
    spiritStones: Math.max(0, spiritStones),
    inventory,
    adventure: life.adventure ? { ...life.adventure, flags } : undefined,
  };
}

function milestoneLevel(config: EventLibraryConfig, resolvedCount: number, currentLevel: number) {
  return config.mainlineProgression.reduce((level, milestone) => {
    if (milestone.trigger.type !== "random_events_resolved") return level;
    return resolvedCount >= (milestone.trigger.count ?? Number.POSITIVE_INFINITY)
      ? Math.max(level, milestone.setLevel)
      : level;
  }, currentLevel);
}

export function resolveEventChoice(
  life: PrologueLife,
  config: EventLibraryConfig,
  choiceId: string,
  engineConfig?: EventEngineConfig,
) {
  const adventure = life.adventure;
  const event = currentRandomEvent(life, config);
  if (!adventure || !event || adventure.lastResolution) return life;
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice || choiceRequirementMessage(choice, life)) return life;

  const engine = engineConfig?.engine ?? DEFAULT_ENGINE;
  const selected = new Set(adventure.selectedItemIds);
  const contextId = choice.resolution.contextId;
  const selectedItems = (life.inventory ?? []).filter((item) => selected.has(item.id) && item.quantity > 0);
  const applicableItems = selectedItems.map((item) => ({
    item,
    effect: item.effects.find((candidate) => candidate.contextId === contextId),
  })).filter((entry) => Boolean(entry.effect));
  const uselessItemNames = selectedItems
    .filter((item) => !item.effects.some((effect) => effect.contextId === contextId))
    .map((item) => item.name);
  const itemMessages = applicableItems.map(({ effect }) => effect?.message).filter((message): message is string => Boolean(message));
  const matchingModifiers = (choice.modifiers ?? []).filter((modifier) => conditionMatches(modifier.when, life));

  let outcomeKey: EventOutcomeKey | "fixed" = "fixed";
  let outcome = choice.outcome;
  let calculation: EventCalculation | undefined;
  if (choice.resolution.mode === "check" && choice.resolution.stat && choice.outcomes) {
    const stat = choice.resolution.stat;
    const statValue = life.stats[stat];
    const cultivationBonus = abilityBonus(life.cultivationArts, true);
    const techniqueBonus = abilityBonus(life.techniques, false);
    const modifierBonus = matchingModifiers.reduce((sum, modifier) => sum + (modifier.checkBonus ?? 0), 0);
    const itemBonus = applicableItems.reduce((sum, entry) => sum + (entry.effect?.checkBonus ?? 0), 0);
    const randomRoll = randomInt(engine.check.randomMinimum, engine.check.randomMaximum);
    const difficulty = (choice.resolution.difficulty ?? 10)
      + matchingModifiers.reduce((sum, modifier) => sum + (modifier.difficultyDelta ?? 0), 0);
    const total = statValue + cultivationBonus + techniqueBonus + modifierBonus + itemBonus + randomRoll;
    const forcedOutcome = [
      ...matchingModifiers.map((modifier) => modifier.forceOutcome),
      ...applicableItems.map((entry) => entry.effect?.forceOutcome as EventOutcomeKey | undefined),
    ].find(Boolean);
    outcomeKey = forcedOutcome ?? resultByMargin(total - difficulty, engine);
    outcome = choice.outcomes[outcomeKey];
    calculation = {
      statLabel: config.statLabels[stat],
      statValue,
      cultivationBonus,
      techniqueBonus,
      modifierBonus,
      itemBonus,
      randomRoll,
      total,
      difficulty,
      margin: total - difficulty,
    };
  }
  if (!outcome) return life;

  const allEffects = [...(choice.costs ?? []), ...outcome.effects];
  let next = applyEffects(life, allEffects, config);
  const usedConsumableIds = new Set(applicableItems.filter((entry) => entry.item.consumable).map((entry) => entry.item.id));
  next = {
    ...next,
    inventory: (next.inventory ?? []).map((item) => usedConsumableIds.has(item.id)
      ? { ...item, quantity: Math.max(0, item.quantity - 1) }
      : item),
  };

  const resolvedCount = adventure.resolvedCount + 1;
  const newLevel = milestoneLevel(config, resolvedCount, next.level);
  const resolutionId = makeId();
  const effectSummaries = allEffects.map((effect) => effectSummary(effect, config)).filter(Boolean);
  if (newLevel !== next.level) effectSummaries.push(`等级 ${next.level} → ${newLevel}`);
  const historyEntry: EventHistoryEntry = {
    resolutionId,
    eventId: event.id,
    title: event.title,
    choiceText: choice.text,
    outcome: outcomeKey,
    resultText: outcome.text,
    effectSummaries,
  };
  const resolution: EventResolution = {
    ...historyEntry,
    itemMessages,
    uselessItemNames,
    effectSummaries,
    calculation,
  };
  return {
    ...next,
    level: newLevel,
    adventure: {
      ...(next.adventure ?? adventure),
      resolvedCount,
      completedEventIds: [...new Set([...adventure.completedEventIds, event.id])],
      recentEventIds: [...adventure.recentEventIds, event.id].slice(-engine.draw.recentEventCooldown),
      selectedItemIds: [],
      history: [...adventure.history, historyEntry],
      lastResolution: resolution,
      stageComplete: resolvedCount >= config.stage.randomEncountersPerLife,
    },
  };
}

export function continueVillageAdventure(
  life: PrologueLife,
  config: EventLibraryConfig,
  engineConfig?: EventEngineConfig,
) {
  if (!life.adventure?.lastResolution) return life;
  const cleared = { ...life, adventure: { ...life.adventure, lastResolution: undefined } };
  return {
    ...cleared,
    adventure: drawNextEvent(cleared, config, cleared.adventure, engineConfig?.engine ?? DEFAULT_ENGINE),
  };
}
