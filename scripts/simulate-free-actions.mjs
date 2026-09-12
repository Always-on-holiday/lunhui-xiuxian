import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  prepareFreeAction,
  previewFreeAction,
  resolveFreeAction,
} from "../lib/free-actions.ts";

const config = JSON.parse(await readFile(new URL("../public/游戏内容/自由行动/自由行动规则.json", import.meta.url), "utf8"));
const evenStats = { attack: 10, defense: 10, speed: 10, intelligence: 10, proficiency: 10 };
const actor = {
  id: "sim-player",
  level: 5,
  stats: evenStats,
  currentHealth: 64,
  maxHealth: 64,
  currentSpirit: 48,
  maxSpirit: 48,
  spiritStones: 20,
  tags: [],
};
const world = { seed: "simulation-v1", locationId: "green-stone-village", locationTags: ["settlement"], witnessCount: 2 };

const scenarios = [
  {
    name: "同级观察",
    actionId: "observe",
    target: { id: "npc-a", name: "普通村民", type: "npc", level: 5, stats: evenStats, relation: 0, tags: ["neutral"], traits: {} },
    chanceRange: [65, 72],
  },
  {
    name: "与商人交易",
    actionId: "trade",
    target: { id: "npc-b", name: "行脚商人", type: "npc", level: 5, stats: evenStats, relation: 0, tags: ["neutral", "merchant"], traits: { bargaining: 0 } },
    chanceRange: [64, 70],
  },
  {
    name: "村中偷窃商人",
    actionId: "steal",
    target: { id: "npc-b", name: "行脚商人", type: "npc", level: 5, stats: evenStats, relation: 0, tags: ["neutral", "merchant"], traits: { alertness: 0 } },
    chanceRange: [18, 25],
  },
  {
    name: "帮助伤者",
    actionId: "help",
    target: { id: "npc-c", name: "受伤散修", type: "npc", level: 5, baseDifficulty: 10, relation: 0, tags: ["wounded"], traits: { severity: 20 } },
    chanceRange: [63, 70],
  },
  {
    name: "击碎坚硬石片",
    actionId: "destroy_item",
    target: { id: "item-a", name: "坚硬石片", type: "item", level: 5, baseDifficulty: 10, relation: 0, tags: ["mineral"], traits: { durability: 50 } },
    chanceRange: [12, 18],
  },
  {
    name: "越十级杀敌",
    actionId: "kill",
    target: { id: "npc-d", name: "高阶修士", type: "npc", level: 15, stats: evenStats, relation: -50, tags: ["hostile"], traits: { alertness: 10 } },
    chanceRange: [1, 5],
    risk: "near_certain_death",
    nextSystem: "combat",
  },
  {
    name: "越二十级杀敌",
    actionId: "kill",
    target: { id: "npc-e", name: "不可战胜者", type: "npc", level: 25, stats: evenStats, relation: -100, tags: ["hostile"], traits: { alertness: 20 } },
    chanceRange: [0, 0],
    risk: "absolute_death",
    nextSystem: "combat",
  },
  {
    name: "吃掉普通食物",
    actionId: "eat_item",
    target: { id: "item-b", name: "干粮", type: "item", level: 1, baseDifficulty: 5, relation: 0, tags: ["food"], traits: { toxicity: 0 } },
    chanceRange: [100, 100],
    risk: "none",
  },
];

const failures = [];
for (const scenario of scenarios) {
  const context = { actor, target: scenario.target, world, actionId: scenario.actionId, attemptCount: 0 };
  const preview = previewFreeAction(context, config);
  if (preview.chance < scenario.chanceRange[0] || preview.chance > scenario.chanceRange[1]) {
    failures.push(`${scenario.name}：预期概率 ${scenario.chanceRange.join("-")}%，实际 ${preview.chance}%`);
  }
  if (scenario.risk && preview.risk !== scenario.risk) failures.push(`${scenario.name}：预期风险 ${scenario.risk}，实际 ${preview.risk}`);

  const sampleSize = preview.mode === "fixed" ? 1 : 5000;
  let successes = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const attempt = prepareFreeAction(context, `${scenario.actionId}-${index}`);
    const first = resolveFreeAction(attempt, config);
    const repeated = resolveFreeAction(attempt, config);
    if (first.roll !== repeated.roll || first.resolutionId !== repeated.resolutionId) {
      failures.push(`${scenario.name}：相同 attemptId 得到了不同结果`);
      break;
    }
    if (first.outcome === "success" || first.outcome === "criticalSuccess") successes += 1;
    if (scenario.nextSystem && first.nextSystem !== scenario.nextSystem) {
      failures.push(`${scenario.name}：预期进入 ${scenario.nextSystem}，实际 ${first.nextSystem}`);
      break;
    }
  }
  const observed = Math.round((successes / sampleSize) * 1000) / 10;
  if (sampleSize > 1 && Math.abs(observed - preview.chance) > 2.5) {
    failures.push(`${scenario.name}：统计成功率 ${observed}% 偏离配置概率 ${preview.chance}%`);
  }
  console.log(`${scenario.name.padEnd(10)} 概率 ${String(preview.chance).padStart(3)}% | 风险 ${preview.riskLabel} | 模拟 ${observed}%`);
}

const repeatedContext = {
  actor,
  target: scenarios[0].target,
  world,
  actionId: "observe",
  attemptCount: 3,
};
const repeatedPreview = previewFreeAction(repeatedContext, config);
if (repeatedPreview.breakdown.repeatPenalty !== -30 || repeatedPreview.chance !== 38) {
  failures.push(`连续尝试：预期 -30% 且最终 38%，实际 ${repeatedPreview.breakdown.repeatPenalty}% / ${repeatedPreview.chance}%`);
}

const deadTarget = { ...scenarios[0].target, state: "dead", overrides: { "kill@dead": { available: false, message: "目标已经死亡。" } } };
const deadPreview = previewFreeAction({ actor, target: deadTarget, world, actionId: "kill", attemptCount: 0 }, config);
if (deadPreview.available) failures.push("失效目标：已经死亡的 NPC 仍可再次执行杀死");

const poorSpiritActor = { ...actor, currentSpirit: 3 };
const spiritPreview = previewFreeAction({ actor: poorSpiritActor, target: scenarios[0].target, world, actionId: "infringe", attemptCount: 0 }, config);
if (spiritPreview.available) failures.push("资源检查：灵力不足时仍可执行侵害动作");

const specialItem = {
  id: "special-item",
  name: "共鸣信物",
  type: "item",
  level: 1,
  baseDifficulty: 10,
  relation: 0,
  tags: ["quest_key"],
  traits: { complexity: 0 },
  overrides: {
    "use_item@green-stone-village": {
      chanceModifier: 30,
      forceOutcome: "success",
      message: "信物与此地产生共鸣。",
      effects: [{ type: "set_flag", id: "special_resonance", value: true }],
    },
  },
};
const specialContext = {
  actor,
  target: specialItem,
  secondaryTarget: scenarios[0].target,
  world,
  actionId: "use_item",
  attemptCount: 0,
};
const specialPreview = previewFreeAction(specialContext, config);
const specialResolution = resolveFreeAction(prepareFreeAction(specialContext, "special-override"), config);
if (specialPreview.chance !== 98 || specialResolution.message !== "信物与此地产生共鸣。" || specialResolution.effects.length !== 1) {
  failures.push("专属覆写：地点修正、强制结果、文字或效果没有完整生效");
}

const costContext = { actor, target: scenarios[0].target, world: { ...world, witnessCount: 0 }, actionId: "infringe", attemptCount: 0 };
const costResolution = resolveFreeAction(prepareFreeAction(costContext, "cost-check"), config);
if (costResolution.costs.spirit !== 8 || costResolution.costs.worldMinutes !== 10) {
  failures.push("行动成本：侵害动作没有返回正确的灵力和世界时间成本");
}

if (failures.length > 0) {
  console.error("\n自由行动模拟失败：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\n自由行动概率、风险分级、战斗转交与防重抽检查通过。");
}
