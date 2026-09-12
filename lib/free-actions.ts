import type { FiveStats, PrologueLife, StatKey } from "@/lib/prologue";

export type FreeActionOutcome = "criticalSuccess" | "success" | "failure" | "criticalFailure";
export type FreeActionRisk = "none" | "low" | "medium" | "high" | "extreme" | "near_certain_death" | "absolute_death";
export type FreeActionMode = "fixed" | "check" | "tag_driven" | "combat_entry" | "check_then_combat_on_failure";
export type FreeActionTargetType = "npc" | "item" | "location" | "mechanism" | "corpse" | "self";

type NumberMap = Record<string, number>;

export type FreeActionDefinition = {
  name: string;
  description?: string;
  targets: FreeActionTargetType[];
  defaultStat?: StatKey;
  defaultRisk: FreeActionRisk;
  cost?: { health?: number; spirit?: number; spiritStones?: number; worldMinutes?: number };
  confirm?: boolean;
  confirmWhenTags?: string[];
  consequences?: string[];
  requiresSecondaryTarget?: boolean;
  requiresSecondaryTargetType?: FreeActionTargetType;
  requiredAnyTag?: string[];
  createsWorldDrop?: boolean;
  fallback?: string;
  fallbackByTag?: Record<string, string>;
};

export type FreeActionProfile = {
  mode: FreeActionMode;
  baseChance: number;
  minimumChance: number;
  maximumChance: number;
  actorWeights: Partial<Record<StatKey, number>>;
  targetWeights: Partial<Record<StatKey, number>>;
  resistanceTrait?: string;
  resistanceTraitFactor?: number;
  levelPercent: number;
  relationFactor: number;
};

export type FreeActionConfig = {
  meta: { version: number; title: string; status: string; design: string };
  interface: {
    recommendedActionLimit: number;
    extraActionsLabel: string;
    alwaysUseAttemptWording: boolean;
    showRiskGrade: boolean;
    showPrimaryStat: boolean;
    showExactFormula: boolean;
    confirmLethalAndIrreversibleActions: boolean;
  };
  targetTypes: FreeActionTargetType[];
  riskGrades: Record<FreeActionRisk, string>;
  actions: Record<string, FreeActionDefinition>;
  actionProfiles: Record<string, FreeActionProfile>;
  algorithm: {
    version: number;
    roll: {
      minimum: number;
      maximum: number;
      persistAttemptBeforeRoll: boolean;
      deterministicFromAttemptId: boolean;
      preventRefreshReroll: boolean;
    };
    chance: {
      formula: string;
      statPointPercent: number;
      defaultLevelPercent: number;
      levelContributionMinimum: number;
      levelContributionMaximum: number;
      defaultMinimumChance: number;
      defaultMaximumChance: number;
      modifierMinimum: number;
      modifierMaximum: number;
      repeatPenaltyPerAttempt: number;
      repeatPenaltyMaximum: number;
      witnessPenaltyPerPerson: number;
      witnessPenaltyMaximum: number;
      witnessSensitiveActions: string[];
    };
    outcomes: {
      criticalSuccessThreshold: string;
      successThreshold: string;
      criticalFailureStart: string;
      order: FreeActionOutcome[];
    };
    preview: {
      showChanceAsRange: boolean;
      baseUncertainty: number;
      intelligenceReductionPerPoint: number;
      minimumUncertainty: number;
      maximumUncertainty: number;
      riskByEstimatedChance: Array<{ minimum: number; grade: FreeActionRisk }>;
    };
    realmProtection: {
      hostileActionLevelGapForWarning: number;
      hostileActionLevelGapForNearCertainDeath: number;
      hostileActionLevelGapForAbsoluteDeath: number;
      nearCertainDeathMaximumChance: number;
      absoluteDeathMaximumChance: number;
      neverHideLethalWarning: boolean;
    };
    resourcePenalties: {
      healthBelow25Percent: number;
      spiritBelow25Percent: number;
      physicalActions: string[];
      spiritualActions: string[];
    };
    combatHandoff: {
      actions: string[];
      criticalSuccessInitiativeBonus: number;
      successInitiativeBonus: number;
      failureInitiativeBonus: number;
      criticalFailureInitiativeBonus: number;
      killSetsLethalCombat: boolean;
      singleCheckCannotKillComparableNpc: boolean;
    };
    idempotency: {
      requireAttemptId: boolean;
      sameAttemptReturnsSameRoll: boolean;
      applyEffectsOnce: boolean;
      saveResolutionId: boolean;
    };
  };
  situationalModifiers: {
    targetTags: Record<string, NumberMap>;
    locationTags: Record<string, NumberMap>;
    actorTags: Record<string, NumberMap>;
  };
};

export type FreeActionActor = {
  id: string;
  level: number;
  stats: FiveStats;
  currentHealth: number;
  maxHealth: number;
  currentSpirit: number;
  maxSpirit: number;
  spiritStones: number;
  tags: string[];
};

export type FreeActionTarget = {
  id: string;
  name: string;
  type: FreeActionTargetType;
  level?: number;
  stats?: Partial<FiveStats>;
  baseDifficulty?: number;
  relation?: number;
  tags: string[];
  state?: string;
  traits?: Record<string, number>;
  overrides?: Record<string, FreeActionOverride>;
};

export type FreeActionWorld = {
  seed: string;
  locationId: string;
  locationTags: string[];
  witnessCount: number;
};

export type FreeActionModifier = {
  id: string;
  label: string;
  value: number;
  hidden?: boolean;
  source: "state" | "tag" | "environment" | "ability" | "item" | "content";
};

export type FreeActionOverride = {
  available?: boolean;
  unavailableReason?: string;
  chanceModifier?: number;
  forceOutcome?: FreeActionOutcome;
  message?: string;
  nextSystem?: "none" | "combat" | "trade" | "dialogue" | "inventory" | "mainline_reroute";
  effects?: Array<Record<string, unknown>>;
};

export type FreeActionContext = {
  actor: FreeActionActor;
  target: FreeActionTarget;
  secondaryTarget?: FreeActionTarget;
  world: FreeActionWorld;
  actionId: string;
  attemptCount: number;
  abilityBonus?: number;
  itemBonus?: number;
  contentModifier?: number;
  modifiers?: FreeActionModifier[];
  override?: FreeActionOverride;
};

export type PreparedFreeAction = {
  attemptId: string;
  context: FreeActionContext;
  preparedAt: string;
};

export type FreeActionBreakdown = {
  baseChance: number;
  actorCheck: number;
  targetCheck: number;
  statDifference: number;
  statContribution: number;
  levelDifference: number;
  levelContribution: number;
  relationContribution: number;
  stateAndTagContribution: number;
  environmentContribution: number;
  abilityBonus: number;
  itemBonus: number;
  contentModifier: number;
  repeatPenalty: number;
  totalBeforeClamp: number;
};

export type FreeActionPreview = {
  available: boolean;
  reason: string;
  actionId: string;
  actionName: string;
  mode: FreeActionMode;
  primaryStat?: StatKey;
  chance: number;
  chanceRange: [number, number];
  risk: FreeActionRisk;
  riskLabel: string;
  requiresConfirmation: boolean;
  lethalWarning: boolean;
  breakdown: FreeActionBreakdown;
};

export type FreeActionResolution = {
  attemptId: string;
  resolutionId: string;
  actionId: string;
  targetId: string;
  outcome: FreeActionOutcome;
  roll: number;
  chance: number;
  criticalSuccessMaximum: number;
  criticalFailureMinimum: number;
  message: string;
  consequences: Array<{ id: string; severity: 1 | 2 }>;
  costs: {
    health: number;
    spirit: number;
    spiritStones: number;
    worldMinutes: number;
  };
  costsAppliedOnAttempt: true;
  costsRefundedWhenUnavailable: true;
  costsConsumedBeforeEffects: true;
  effects: Array<Record<string, unknown>>;
  nextSystem: "none" | "combat" | "trade" | "dialogue" | "inventory" | "mainline_reroute";
  combat?: { lethal: boolean; initiativeBonus: number };
  breakdown: FreeActionBreakdown;
};

const HOSTILE_ACTIONS = new Set(["threaten", "steal", "rob", "attack", "kill", "infringe"]);

function clamp(minimum: number, maximum: number, value: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function weightedStats(stats: Partial<FiveStats> | undefined, weights: Partial<Record<StatKey, number>>, fallback: number) {
  const entries = Object.entries(weights) as Array<[StatKey, number]>;
  if (entries.length === 0) return fallback;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return fallback;
  return entries.reduce((sum, [key, weight]) => sum + (stats?.[key] ?? fallback) * weight, 0) / totalWeight;
}

function tagModifier(actionId: string, tags: string[], table: Record<string, NumberMap>) {
  return tags.reduce((sum, tag) => sum + (table[tag]?.[actionId] ?? 0), 0);
}

function hasResources(actor: FreeActionActor, action: FreeActionDefinition) {
  if ((action.cost?.health ?? 0) >= actor.currentHealth) return "气血不足，无法承担这次行动。";
  if ((action.cost?.spirit ?? 0) > actor.currentSpirit) return "灵力不足，无法发动这次行动。";
  if ((action.cost?.spiritStones ?? 0) > actor.spiritStones) return "灵石不足，无法进行这次行动。";
  return "";
}

function unavailableReason(context: FreeActionContext, action: FreeActionDefinition, override?: FreeActionOverride) {
  if (override?.available === false) return override.unavailableReason ?? override.message ?? "当前状态下不能进行这个动作。";
  if (!action.targets.includes(context.target.type)) return "这个动作不能用于当前对象。";
  if (context.target.state === "missing") return "目标已经不在这里。";
  if (context.target.state === "dead" && context.target.type === "npc") return "目标已经死亡，应该改为操作尸体。";
  if (action.requiresSecondaryTarget && !context.secondaryTarget) return "需要再选择一个作用对象。";
  if (action.requiresSecondaryTargetType && context.secondaryTarget?.type !== action.requiresSecondaryTargetType) {
    return "第二个对象的类型不符合要求。";
  }
  if (action.requiredAnyTag?.length && !action.requiredAnyTag.some((tag) => context.target.tags.includes(tag))) {
    return "这件东西没有合适的使用或装备方式。";
  }
  return hasResources(context.actor, action);
}

function mergeOverrides(...overrides: Array<FreeActionOverride | undefined>) {
  return overrides.reduce<FreeActionOverride>((merged, override) => override ? {
    ...merged,
    ...override,
    effects: [...(merged.effects ?? []), ...(override.effects ?? [])],
  } : merged, {});
}

function contextualOverride(context: FreeActionContext) {
  const overrides = context.target.overrides ?? {};
  const actionId = context.actionId;
  const matchingTagOverrides = context.target.tags.map((tag) => overrides[`${actionId}@${tag}`]);
  return mergeOverrides(
    overrides[actionId],
    ...matchingTagOverrides,
    context.target.state ? overrides[`${actionId}@${context.target.state}`] : undefined,
    overrides[`${actionId}@${context.world.locationId}`],
    context.override,
  );
}

function resolvedOverride(context: FreeActionContext, outcome: FreeActionOutcome) {
  return mergeOverrides(contextualOverride(context), context.target.overrides?.[`${context.actionId}.${outcome}`]);
}

function deterministicRoll(seed: string, minimum: number, maximum: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  const normalized = (hash >>> 0) / 4294967296;
  return minimum + Math.floor(normalized * (maximum - minimum + 1));
}

function effectiveMode(actionId: string, profile: FreeActionProfile, target: FreeActionTarget): FreeActionMode {
  if (profile.mode !== "tag_driven") return profile.mode;
  if (actionId === "eat_item") {
    if (target.tags.includes("food") && !target.tags.includes("toxic")) return "fixed";
    if (target.tags.includes("mineral") || target.tags.includes("quest_key")) return "fixed";
    return "check";
  }
  return "check";
}

function fixedOutcome(actionId: string, target: FreeActionTarget): FreeActionOutcome {
  if (actionId === "eat_item" && (target.tags.includes("mineral") || target.tags.includes("quest_key"))) return "failure";
  return "success";
}

function criticalThresholds(chance: number) {
  return {
    criticalSuccessMaximum: Math.round(Math.min(chance, clamp(5, 30, chance - 50))),
    criticalFailureMinimum: Math.round(clamp(55, 96, chance + 30)),
  };
}

function outcomeFromRoll(roll: number, chance: number): FreeActionOutcome {
  const { criticalSuccessMaximum, criticalFailureMinimum } = criticalThresholds(chance);
  if (roll <= criticalSuccessMaximum) return "criticalSuccess";
  if (roll <= chance) return "success";
  if (roll >= criticalFailureMinimum) return "criticalFailure";
  return "failure";
}

function chanceRisk(chance: number, config: FreeActionConfig): FreeActionRisk {
  return [...config.algorithm.preview.riskByEstimatedChance]
    .sort((left, right) => right.minimum - left.minimum)
    .find((entry) => chance >= entry.minimum)?.grade ?? "near_certain_death";
}

function actionMessage(action: FreeActionDefinition, target: FreeActionTarget, outcome: FreeActionOutcome, override?: FreeActionOverride) {
  if (override?.message) return override.message;
  if (action.fallbackByTag) {
    const tag = target.tags.find((candidate) => action.fallbackByTag?.[candidate]);
    if (tag) return action.fallbackByTag[tag];
  }
  if (outcome === "criticalSuccess") return `${action.name}取得了远超预期的结果。`;
  if (outcome === "success") return `${action.name}成功了。`;
  if (outcome === "criticalFailure") return `${action.fallback ?? "行动失败。"}情况比预想中更糟。`;
  return action.fallback ?? "行动没有取得预期结果。";
}

function nextSystemFor(actionId: string, mode: FreeActionMode, outcome: FreeActionOutcome, override?: FreeActionOverride) {
  if (override?.nextSystem) return override.nextSystem;
  if (mode === "combat_entry") return "combat" as const;
  if (mode === "check_then_combat_on_failure" && (outcome === "failure" || outcome === "criticalFailure")) return "combat" as const;
  if (actionId === "trade" && (outcome === "success" || outcome === "criticalSuccess")) return "trade" as const;
  if (actionId === "talk" && (outcome === "success" || outcome === "criticalSuccess")) return "dialogue" as const;
  if (["inspect_item", "use_item", "eat_item", "equip_item", "combine_item", "destroy_item", "discard_item"].includes(actionId)) return "inventory" as const;
  return "none" as const;
}

export function isFreeActionConfig(value: unknown): value is FreeActionConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FreeActionConfig>;
  return Boolean(
    candidate.algorithm?.chance
      && candidate.algorithm.outcomes
      && candidate.actions
      && candidate.actionProfiles
      && candidate.situationalModifiers,
  );
}

export function prepareFreeAction(context: FreeActionContext, attemptId?: string): PreparedFreeAction {
  const id = attemptId ?? (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return { attemptId: id, context, preparedAt: new Date().toISOString() };
}

export function freeActionActorFromLife(playerId: string, life: PrologueLife, extraTags: string[] = []): FreeActionActor {
  const tags = new Set(extraTags);
  if (life.origin?.id === "merchant_clan") tags.add("merchant_background");
  if (life.currentHealth < life.maxHealth * 0.5) tags.add("injured");
  if (life.hiddenTalent?.id) tags.add(`talent:${life.hiddenTalent.id}`);
  return {
    id: playerId,
    level: life.level,
    stats: { ...life.stats },
    currentHealth: life.currentHealth,
    maxHealth: life.maxHealth,
    currentSpirit: life.currentSpirit,
    maxSpirit: life.maxSpirit,
    spiritStones: life.spiritStones ?? 0,
    tags: [...tags],
  };
}

export function previewFreeAction(context: FreeActionContext, config: FreeActionConfig): FreeActionPreview {
  const action = config.actions[context.actionId];
  const profile = config.actionProfiles[context.actionId];
  if (!action || !profile) throw new Error(`自由行动配置缺少动作：${context.actionId}`);
  const activeOverride = contextualOverride(context);
  const reason = unavailableReason(context, action, activeOverride);
  const mode = effectiveMode(context.actionId, profile, context.target);
  const actorCheck = weightedStats(context.actor.stats, profile.actorWeights, 10);
  const targetCheck = weightedStats(context.target.stats, profile.targetWeights, context.target.baseDifficulty ?? 10);
  const statDifference = actorCheck - targetCheck;
  const statContribution = statDifference * config.algorithm.chance.statPointPercent;
  const levelDifference = context.actor.level - (context.target.level ?? context.actor.level);
  const levelContribution = clamp(
    config.algorithm.chance.levelContributionMinimum,
    config.algorithm.chance.levelContributionMaximum,
    levelDifference * (profile.levelPercent ?? config.algorithm.chance.defaultLevelPercent),
  );
  const relationContribution = (context.target.relation ?? 0) * profile.relationFactor;
  const modifierMinimum = config.algorithm.chance.modifierMinimum;
  const modifierMaximum = config.algorithm.chance.modifierMaximum;
  const actorTagContribution = tagModifier(context.actionId, context.actor.tags, config.situationalModifiers.actorTags);
  const targetTags = [...new Set([...context.target.tags, ...(context.target.state ? [context.target.state] : [])])];
  const targetTagContribution = tagModifier(context.actionId, targetTags, config.situationalModifiers.targetTags);
  const configuredEnvironmentContribution = tagModifier(context.actionId, context.world.locationTags, config.situationalModifiers.locationTags);
  const resistanceContribution = -((context.target.traits?.[profile.resistanceTrait ?? ""] ?? 0) * (profile.resistanceTraitFactor ?? 0));
  const suppliedStateModifiers = (context.modifiers ?? [])
    .filter((modifier) => modifier.source === "state" || modifier.source === "tag")
    .reduce((sum, modifier) => sum + modifier.value, 0);
  const suppliedEnvironmentModifiers = (context.modifiers ?? [])
    .filter((modifier) => modifier.source === "environment")
    .reduce((sum, modifier) => sum + modifier.value, 0);
  let resourcePenalty = 0;
  if (context.actor.maxHealth > 0 && context.actor.currentHealth / context.actor.maxHealth < 0.25
    && config.algorithm.resourcePenalties.physicalActions.includes(context.actionId)) {
    resourcePenalty += config.algorithm.resourcePenalties.healthBelow25Percent;
  }
  if (context.actor.maxSpirit > 0 && context.actor.currentSpirit / context.actor.maxSpirit < 0.25
    && config.algorithm.resourcePenalties.spiritualActions.includes(context.actionId)) {
    resourcePenalty += config.algorithm.resourcePenalties.spiritBelow25Percent;
  }
  const witnessPenalty = config.algorithm.chance.witnessSensitiveActions.includes(context.actionId)
    ? Math.max(
      config.algorithm.chance.witnessPenaltyMaximum,
      Math.max(0, context.world.witnessCount) * config.algorithm.chance.witnessPenaltyPerPerson,
    )
    : 0;
  const stateAndTagContribution = clamp(
    modifierMinimum,
    modifierMaximum,
    actorTagContribution + targetTagContribution + resistanceContribution + suppliedStateModifiers + resourcePenalty,
  );
  const environmentContribution = clamp(
    modifierMinimum,
    modifierMaximum,
    configuredEnvironmentContribution + suppliedEnvironmentModifiers + witnessPenalty,
  );
  const abilityBonus = clamp(
    modifierMinimum,
    modifierMaximum,
    (context.abilityBonus ?? 0) + (context.modifiers ?? [])
      .filter((modifier) => modifier.source === "ability")
      .reduce((sum, modifier) => sum + modifier.value, 0),
  );
  const itemBonus = clamp(
    modifierMinimum,
    modifierMaximum,
    (context.itemBonus ?? 0) + (context.modifiers ?? [])
      .filter((modifier) => modifier.source === "item")
      .reduce((sum, modifier) => sum + modifier.value, 0),
  );
  const contentModifier = clamp(
    modifierMinimum,
    modifierMaximum,
    (context.contentModifier ?? 0) + (activeOverride.chanceModifier ?? 0) + (context.modifiers ?? [])
      .filter((modifier) => modifier.source === "content")
      .reduce((sum, modifier) => sum + modifier.value, 0),
  );
  const repeatPenalty = Math.max(
    config.algorithm.chance.repeatPenaltyMaximum,
    Math.max(0, context.attemptCount) * config.algorithm.chance.repeatPenaltyPerAttempt,
  );
  const totalBeforeClamp = profile.baseChance
    + statContribution
    + levelContribution
    + relationContribution
    + stateAndTagContribution
    + environmentContribution
    + abilityBonus
    + itemBonus
    + contentModifier
    + repeatPenalty;
  let chance = mode === "fixed" ? 100 : clamp(profile.minimumChance, profile.maximumChance, totalBeforeClamp);
  const hostileLevelGap = (context.target.level ?? context.actor.level) - context.actor.level;
  const lethalWarning = HOSTILE_ACTIONS.has(context.actionId)
    && hostileLevelGap >= config.algorithm.realmProtection.hostileActionLevelGapForWarning;
  if (HOSTILE_ACTIONS.has(context.actionId)
    && hostileLevelGap >= config.algorithm.realmProtection.hostileActionLevelGapForAbsoluteDeath) {
    chance = Math.min(chance, config.algorithm.realmProtection.absoluteDeathMaximumChance);
  } else if (HOSTILE_ACTIONS.has(context.actionId)
    && hostileLevelGap >= config.algorithm.realmProtection.hostileActionLevelGapForNearCertainDeath) {
    chance = Math.min(chance, config.algorithm.realmProtection.nearCertainDeathMaximumChance);
  }
  chance = Math.round(chance);
  const uncertainty = clamp(
    config.algorithm.preview.minimumUncertainty,
    config.algorithm.preview.maximumUncertainty,
    config.algorithm.preview.baseUncertainty
      - context.actor.stats.intelligence * config.algorithm.preview.intelligenceReductionPerPoint,
  );
  const risk = mode === "fixed"
    ? "none" as FreeActionRisk
    : HOSTILE_ACTIONS.has(context.actionId) && hostileLevelGap >= config.algorithm.realmProtection.hostileActionLevelGapForAbsoluteDeath
      ? "absolute_death" as FreeActionRisk
      : lethalWarning && hostileLevelGap >= config.algorithm.realmProtection.hostileActionLevelGapForNearCertainDeath
        ? "near_certain_death" as FreeActionRisk
        : chanceRisk(chance, config);
  const breakdown: FreeActionBreakdown = {
    baseChance: profile.baseChance,
    actorCheck: round(actorCheck),
    targetCheck: round(targetCheck),
    statDifference: round(statDifference),
    statContribution: round(statContribution),
    levelDifference,
    levelContribution: round(levelContribution),
    relationContribution: round(relationContribution),
    stateAndTagContribution: round(stateAndTagContribution),
    environmentContribution: round(environmentContribution),
    abilityBonus: round(abilityBonus),
    itemBonus: round(itemBonus),
    contentModifier: round(contentModifier),
    repeatPenalty,
    totalBeforeClamp: round(totalBeforeClamp),
  };
  return {
    available: !reason,
    reason,
    actionId: context.actionId,
    actionName: action.name,
    mode,
    primaryStat: action.defaultStat,
    chance,
    chanceRange: mode === "fixed"
      ? [chance, chance]
      : [Math.max(0, Math.round(chance - uncertainty)), Math.min(100, Math.round(chance + uncertainty))],
    risk,
    riskLabel: config.riskGrades[risk],
    requiresConfirmation: Boolean(action.confirm
      || action.confirmWhenTags?.some((tag) => context.target.tags.includes(tag))),
    lethalWarning,
    breakdown,
  };
}

export function resolveFreeAction(attempt: PreparedFreeAction, config: FreeActionConfig): FreeActionResolution {
  if (!attempt.attemptId) throw new Error("自由行动结算缺少 attemptId，不能安全防止重复结算。");
  const preview = previewFreeAction(attempt.context, config);
  if (!preview.available) throw new Error(preview.reason);
  const action = config.actions[attempt.context.actionId];
  const activeOverride = contextualOverride(attempt.context);
  const seed = [
    attempt.context.world.seed,
    attempt.attemptId,
    attempt.context.actor.id,
    attempt.context.target.id,
    attempt.context.secondaryTarget?.id ?? "none",
    attempt.context.actionId,
  ].join(":");
  const roll = deterministicRoll(seed, config.algorithm.roll.minimum, config.algorithm.roll.maximum);
  const outcome = activeOverride.forceOutcome
    ?? (preview.mode === "fixed" ? fixedOutcome(attempt.context.actionId, attempt.context.target) : outcomeFromRoll(roll, preview.chance));
  const finalOverride = resolvedOverride(attempt.context, outcome);
  const thresholds = criticalThresholds(preview.chance);
  const nextSystem = nextSystemFor(attempt.context.actionId, preview.mode, outcome, finalOverride);
  const initiativeBonus = outcome === "criticalSuccess"
    ? config.algorithm.combatHandoff.criticalSuccessInitiativeBonus
    : outcome === "success"
      ? config.algorithm.combatHandoff.successInitiativeBonus
      : outcome === "failure"
        ? config.algorithm.combatHandoff.failureInitiativeBonus
        : config.algorithm.combatHandoff.criticalFailureInitiativeBonus;
  const severity: 1 | 2 = outcome === "criticalFailure" ? 2 : 1;

  return {
    attemptId: attempt.attemptId,
    resolutionId: `free-action:${attempt.attemptId}`,
    actionId: attempt.context.actionId,
    targetId: attempt.context.target.id,
    outcome,
    roll,
    chance: preview.chance,
    ...thresholds,
    message: actionMessage(action, attempt.context.target, outcome, finalOverride),
    consequences: (action.consequences ?? []).map((id) => ({ id, severity })),
    costs: {
      health: action.cost?.health ?? 0,
      spirit: action.cost?.spirit ?? 0,
      spiritStones: action.cost?.spiritStones ?? 0,
      worldMinutes: action.cost?.worldMinutes ?? 0,
    },
    costsAppliedOnAttempt: true,
    costsRefundedWhenUnavailable: true,
    costsConsumedBeforeEffects: true,
    effects: finalOverride.effects ?? [],
    nextSystem,
    combat: nextSystem === "combat" ? {
      lethal: attempt.context.actionId === "kill" && config.algorithm.combatHandoff.killSetsLethalCombat,
      initiativeBonus,
    } : undefined,
    breakdown: preview.breakdown,
  };
}
