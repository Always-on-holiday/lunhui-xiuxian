import type { InventoryItem, LearnedAbility, PrologueLife } from "@/lib/prologue";

export type PlayerLifeStatus = "alive" | "soul" | "rebirth";

export type SoulHistoryEntry = {
  id: string;
  worldDay: number;
  actionId: string;
  title: string;
  text: string;
  targetName?: string;
};

export type DeathState = {
  status: "soul";
  deathDay: number;
  deadlineDay: number;
  soulPower: number;
  lastActionDay?: number;
  history: SoulHistoryEntry[];
};

export type FateMark = {
  id: string;
  name: string;
  description: string;
};

export type InheritedMemory = {
  id: string;
  name: string;
  description: string;
};

export type LifeInheritance = {
  cultivationArt?: LearnedAbility;
  item?: InventoryItem;
  memory?: InheritedMemory;
};

export type CycleSecretState = {
  resolved: boolean;
  completed: boolean;
  choiceId?: string;
  resultTitle?: string;
  resultText?: string;
  flag?: string;
};

export type SoulActionConfig = {
  id: string;
  title: string;
  description: string;
  target: "none" | "living";
  powerGain: number;
  baseSpiritDrain?: number;
  expiredSpiritDrainBonus?: number;
  resultText: string;
};

export type RevivalMethodConfig = {
  id: string;
  title: string;
  description: string;
  actorCost?: {
    spiritStones?: number;
    spirit?: number;
    itemId?: string;
    itemQuantity?: number;
  };
  selfOnly?: boolean;
  soulPowerCost?: number;
  expiredSoulPowerCost?: number;
};

export type ReincarnationConfig = {
  meta: { version: number; title: string };
  death: {
    title: string;
    summary: string;
    deadlineDays: number;
    reviveHealthPercent: number;
    reviveSpiritPercent: number;
    minimumSpiritFloorPercent: number;
    maximumDrainPercent: number;
    expiredTitle: string;
    expiredText: string;
    testDeathButton: string;
    testDeathHint: string;
    confirmTitle: string;
    confirmText: string;
    confirmButton: string;
  };
  soul: {
    panelTitle: string;
    powerLabel: string;
    deadlineLabel: string;
    actionReady: string;
    actionSpent: string;
    noLivingTarget: string;
    historyTitle: string;
    actions: SoulActionConfig[];
  };
  revival: {
    title: string;
    summary: string;
    methods: RevivalMethodConfig[];
    fateMarks: FateMark[];
  };
  inheritance: {
    title: string;
    summary: string;
    artLabel: string;
    itemLabel: string;
    memoryLabel: string;
    noneLabel: string;
    beginButton: string;
    legacyArts: Array<LearnedAbility & { unlock?: { stageComplete?: boolean } }>;
    memories: InheritedMemory[];
  };
  cycleSecret: {
    id: string;
    title: string;
    intro: string;
    requiredCycle: number;
    requiredArtId: string;
    eyebrow: string;
    choices: Array<{
      id: string;
      title: string;
      requiresArtId?: string;
      resultTitle: string;
      resultText: string;
      setFlag?: string;
    }>;
    continueButton: string;
  };
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isReincarnationConfig(value: unknown): value is ReincarnationConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReincarnationConfig>;
  return Boolean(
    candidate.death
      && Number.isFinite(candidate.death.deadlineDays)
      && Array.isArray(candidate.soul?.actions)
      && Array.isArray(candidate.revival?.methods)
      && Array.isArray(candidate.revival?.fateMarks)
      && Array.isArray(candidate.inheritance?.memories)
      && Array.isArray(candidate.cycleSecret?.choices),
  );
}

export function isSoulExpired(state: DeathState, worldDay: number) {
  return worldDay > state.deadlineDay;
}

export function enterSoulState(life: PrologueLife, worldDay: number, config: ReincarnationConfig): PrologueLife {
  if (life.deathState?.status === "soul") return life;
  return {
    ...life,
    currentHealth: 0,
    deathState: {
      status: "soul",
      deathDay: worldDay,
      deadlineDay: worldDay + config.death.deadlineDays,
      soulPower: 0,
      history: [],
    },
  };
}

export function recordSoulAction(
  life: PrologueLife,
  action: SoulActionConfig,
  worldDay: number,
  soulPower: number,
  targetName?: string,
) {
  if (!life.deathState) return life;
  const historyEntry: SoulHistoryEntry = {
    id: makeId(),
    worldDay,
    actionId: action.id,
    title: action.title,
    text: action.resultText,
    targetName,
  };
  return {
    ...life,
    deathState: {
      ...life.deathState,
      soulPower,
      lastActionDay: worldDay,
      history: [...life.deathState.history, historyEntry],
    },
  };
}

export function reviveLife(life: PrologueLife, config: ReincarnationConfig): PrologueLife {
  const marks = config.revival.fateMarks;
  const mark = marks.length > 0 ? marks[Math.floor(Math.random() * marks.length)] : undefined;
  const existingMarks = life.deathMarks ?? [];
  return {
    ...life,
    currentHealth: Math.max(1, Math.round(life.maxHealth * config.death.reviveHealthPercent / 100)),
    currentSpirit: Math.max(0, Math.round(life.maxSpirit * config.death.reviveSpiritPercent / 100)),
    deathState: undefined,
    deathMarks: mark && !existingMarks.some((candidate) => candidate.id === mark.id)
      ? [...existingMarks, { ...mark }]
      : existingMarks,
  };
}

export function applyPendingSpiritLoss(life: PrologueLife, amount: number) {
  if (amount <= 0 || life.deathState) return life;
  return {
    ...life,
    currentSpirit: Math.max(0, life.currentSpirit - amount),
  };
}

export function applyInheritance(life: PrologueLife, inheritance?: LifeInheritance, cycle = 1): PrologueLife {
  if (!inheritance) return { ...life, cycle };
  const arts = [...(life.cultivationArts ?? [])];
  if (inheritance.cultivationArt && !arts.some((entry) => entry.id === inheritance.cultivationArt?.id)) {
    arts.push({ ...inheritance.cultivationArt });
  }
  const inventory = [...(life.inventory ?? [])];
  if (inheritance.item) {
    const existing = inventory.find((entry) => entry.id === inheritance.item?.id);
    if (existing) existing.quantity += 1;
    else inventory.push({ ...inheritance.item, quantity: 1, effects: inheritance.item.effects.map((effect) => ({ ...effect })) });
  }
  return {
    ...life,
    cycle,
    cultivationArts: arts,
    inventory,
    inheritedMemory: inheritance.memory ? { ...inheritance.memory } : undefined,
    inheritance: {
      cultivationArt: inheritance.cultivationArt ? { ...inheritance.cultivationArt } : undefined,
      item: inheritance.item
        ? { ...inheritance.item, quantity: 1, effects: inheritance.item.effects.map((effect) => ({ ...effect })) }
        : undefined,
      memory: inheritance.memory ? { ...inheritance.memory } : undefined,
    },
  };
}

export function shouldShowCycleSecret(life: PrologueLife, config: ReincarnationConfig) {
  return (life.cycle ?? 1) >= config.cycleSecret.requiredCycle
    && Boolean(life.cultivationArts?.some((art) => art.id === config.cycleSecret.requiredArtId))
    && !life.cycleSecret?.completed;
}

export function resolveCycleSecret(life: PrologueLife, choiceId: string, config: ReincarnationConfig) {
  if (life.cycleSecret?.resolved) return life;
  const choice = config.cycleSecret.choices.find((entry) => entry.id === choiceId);
  if (!choice) return life;
  if (choice.requiresArtId && !life.cultivationArts?.some((art) => art.id === choice.requiresArtId)) return life;
  return {
    ...life,
    cycleSecret: {
      resolved: true,
      completed: false,
      choiceId: choice.id,
      resultTitle: choice.resultTitle,
      resultText: choice.resultText,
      flag: choice.setFlag,
    },
  };
}

export function completeCycleSecret(life: PrologueLife) {
  if (!life.cycleSecret?.resolved) return life;
  return { ...life, cycleSecret: { ...life.cycleSecret, completed: true } };
}
