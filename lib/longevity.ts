import type { PrologueLife, StatKey } from "@/lib/prologue";

export type TimeSystemRules = {
  daysPerYear: number;
  realSecondsPerDay: number;
  startingAgeYears: number;
  lifespan: {
    baseYears: number;
    physiqueStat: StatKey;
    physiqueBaseline: number;
    daysPerPhysiquePoint: number;
    daysPerLevel: number;
    revivalGraceDays: number;
    realmBonusYears: Record<string, number>;
  };
  costs: {
    birthStepDays: number;
    sideQuestDays: number;
    trainingDays: number;
    trialDays: number;
    randomEventDays: number;
  };
};

export type LifeTimeline = {
  version: 1;
  ageDays: number;
  lifespanDays: number;
  lastTickAt: number;
  lastTimeCost?: { days: number; reason: string };
};

const FALLBACK_DAYS_PER_YEAR = 365;

function positiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function calculateLifespanDays(
  life: Pick<PrologueLife, "level" | "realm" | "stats">,
  rules: TimeSystemRules,
) {
  const daysPerYear = positiveInteger(rules.daysPerYear, FALLBACK_DAYS_PER_YEAR);
  const physique = life.stats[rules.lifespan.physiqueStat] ?? 0;
  const physiquePoints = Math.max(0, physique - rules.lifespan.physiqueBaseline);
  const realmBonusYears = Object.entries(rules.lifespan.realmBonusYears)
    .find(([realm]) => life.realm.includes(realm))?.[1] ?? 0;

  return Math.max(
    daysPerYear,
    Math.round(
      (rules.lifespan.baseYears + realmBonusYears) * daysPerYear
      + physiquePoints * rules.lifespan.daysPerPhysiquePoint
      + Math.max(0, life.level - 1) * rules.lifespan.daysPerLevel,
    ),
  );
}

export function createLifeTimeline(
  life: Pick<PrologueLife, "level" | "realm" | "stats">,
  rules: TimeSystemRules,
  now = Date.now(),
): LifeTimeline {
  const daysPerYear = positiveInteger(rules.daysPerYear, FALLBACK_DAYS_PER_YEAR);
  return {
    version: 1,
    ageDays: Math.max(0, Math.round(rules.startingAgeYears * daysPerYear)),
    lifespanDays: calculateLifespanDays(life, rules),
    lastTickAt: now,
  };
}

export function normalizeLifeTimeline(
  life: PrologueLife,
  rules: TimeSystemRules,
  now = Date.now(),
): PrologueLife {
  const current = life.timeline ?? createLifeTimeline(life, rules, now);
  return {
    ...life,
    timeline: {
      ...current,
      lifespanDays: calculateLifespanDays(life, rules),
      lastTickAt: now,
    },
  };
}

export function spendLifeTime(
  life: PrologueLife,
  days: number,
  reason: string,
  rules: TimeSystemRules,
  now = Date.now(),
): PrologueLife {
  const normalized = normalizeLifeTimeline(life, rules, now);
  const timeline = normalized.timeline!;
  return {
    ...normalized,
    timeline: {
      ...timeline,
      ageDays: Math.min(timeline.lifespanDays, timeline.ageDays + Math.max(0, Math.round(days))),
      lastTickAt: now,
      lastTimeCost: { days: Math.max(0, Math.round(days)), reason },
    },
  };
}

export function tickLifeTime(
  life: PrologueLife,
  rules: TimeSystemRules,
  now = Date.now(),
): PrologueLife {
  const normalized = life.timeline ? life : normalizeLifeTimeline(life, rules, now);
  const timeline = normalized.timeline!;
  if (timeline.ageDays >= timeline.lifespanDays) return normalized;
  const millisecondsPerDay = positiveInteger(rules.realSecondsPerDay, 60) * 1000;
  const elapsedDays = Math.floor(Math.max(0, now - timeline.lastTickAt) / millisecondsPerDay);
  if (elapsedDays <= 0) return normalized;
  return spendLifeTime(normalized, elapsedDays, "岁月自然流逝", rules, timeline.lastTickAt + elapsedDays * millisecondsPerDay);
}

export function isLifeExpired(life: PrologueLife | null) {
  return Boolean(life?.timeline && life.timeline.ageDays >= life.timeline.lifespanDays);
}

export function renewLifeAfterRevival(
  life: PrologueLife,
  rules: TimeSystemRules,
  now = Date.now(),
): PrologueLife {
  const normalized = normalizeLifeTimeline(life, rules, now);
  const timeline = normalized.timeline!;
  if (timeline.ageDays < timeline.lifespanDays) return normalized;
  const graceDays = positiveInteger(rules.lifespan.revivalGraceDays, rules.daysPerYear);
  return {
    ...normalized,
    timeline: {
      ...timeline,
      ageDays: Math.max(0, timeline.lifespanDays - graceDays),
      lastTickAt: now,
      lastTimeCost: undefined,
    },
  };
}

export function formatYearsAndDays(days: number, daysPerYear = FALLBACK_DAYS_PER_YEAR) {
  const safeDaysPerYear = positiveInteger(daysPerYear, FALLBACK_DAYS_PER_YEAR);
  const safeDays = Math.max(0, Math.round(days));
  return `${Math.floor(safeDays / safeDaysPerYear)}年${safeDays % safeDaysPerYear}天`;
}

export function approximateYears(days: number, daysPerYear = FALLBACK_DAYS_PER_YEAR) {
  const safeDaysPerYear = positiveInteger(daysPerYear, FALLBACK_DAYS_PER_YEAR);
  return Math.round(Math.max(0, days) / safeDaysPerYear);
}
