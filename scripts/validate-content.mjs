import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const contentRoot = path.join(projectRoot, "public", "游戏内容");
const errors = [];

function fail(location, message) {
  errors.push(`${location}: ${message}`);
}

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(target);
    return entry.isFile() && entry.name.endsWith(".json") ? [target] : [];
  }));
  return nested.flat();
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(path.relative(projectRoot, file), `JSON 格式错误：${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function validateFreeActions(config) {
  const location = "public/游戏内容/自由行动/自由行动规则.json";
  if (!config?.actions || !config?.actionProfiles || !config?.algorithm) {
    fail(location, "缺少 actions、actionProfiles 或 algorithm");
    return;
  }
  const actionIds = Object.keys(config.actions);
  const profileIds = Object.keys(config.actionProfiles);
  for (const id of actionIds) {
    if (!config.actionProfiles[id]) fail(`${location}#actions.${id}`, "缺少同名 actionProfile");
  }
  for (const id of profileIds) {
    if (!config.actions[id]) fail(`${location}#actionProfiles.${id}`, "没有同名 action 定义");
  }

  const targetTypes = new Set(config.targetTypes ?? []);
  const modes = new Set(["fixed", "check", "tag_driven", "combat_entry", "check_then_combat_on_failure"]);
  for (const [id, action] of Object.entries(config.actions)) {
    for (const target of action.targets ?? []) {
      if (!targetTypes.has(target)) fail(`${location}#actions.${id}`, `未知目标类型 ${target}`);
    }
    for (const target of action.requiresSecondaryTargetType ? [action.requiresSecondaryTargetType] : []) {
      if (!targetTypes.has(target)) fail(`${location}#actions.${id}`, `未知第二目标类型 ${target}`);
    }
  }

  for (const [id, profile] of Object.entries(config.actionProfiles)) {
    if (!modes.has(profile.mode)) fail(`${location}#actionProfiles.${id}`, `未知模式 ${profile.mode}`);
    for (const key of ["baseChance", "minimumChance", "maximumChance", "levelPercent", "relationFactor"]) {
      if (!Number.isFinite(profile[key])) fail(`${location}#actionProfiles.${id}.${key}`, "必须是有限数字");
    }
    for (const key of ["baseChance", "minimumChance", "maximumChance"]) {
      if (profile[key] < 0 || profile[key] > 100) fail(`${location}#actionProfiles.${id}.${key}`, "概率必须在 0—100 之间");
    }
    if (profile.minimumChance > profile.maximumChance) fail(`${location}#actionProfiles.${id}`, "minimumChance 不能大于 maximumChance");
    for (const group of ["actorWeights", "targetWeights"]) {
      const values = Object.values(profile[group] ?? {});
      if (values.some((value) => !Number.isFinite(value) || value < 0)) fail(`${location}#actionProfiles.${id}.${group}`, "权重必须是非负有限数字");
      const sum = values.reduce((total, value) => total + value, 0);
      if (values.length > 0 && Math.abs(sum - 1) > 0.001) fail(`${location}#actionProfiles.${id}.${group}`, `权重和应为 1，当前为 ${sum}`);
    }
  }

  for (const [groupName, group] of Object.entries(config.situationalModifiers ?? {})) {
    for (const [tag, modifiers] of Object.entries(group)) {
      for (const [actionId, value] of Object.entries(modifiers)) {
        if (!config.actions[actionId]) fail(`${location}#situationalModifiers.${groupName}.${tag}`, `引用了未知动作 ${actionId}`);
        if (!Number.isFinite(value)) fail(`${location}#situationalModifiers.${groupName}.${tag}.${actionId}`, "修正值必须是有限数字");
      }
    }
  }
  for (const actionId of config.algorithm?.chance?.witnessSensitiveActions ?? []) {
    if (!config.actions[actionId]) fail(`${location}#algorithm.chance.witnessSensitiveActions`, `引用了未知动作 ${actionId}`);
  }

  for (const [exampleId, example] of Object.entries(config.examples ?? {})) {
    for (const actionId of [...(example.recommendedActions ?? []), ...(example.extraActions ?? [])]) {
      if (!config.actions[actionId]) fail(`${location}#examples.${exampleId}`, `引用了未知动作 ${actionId}`);
    }
    for (const overrideKey of Object.keys(example.overrides ?? {})) {
      const actionId = overrideKey.split(/[.@]/, 1)[0];
      if (!config.actions[actionId]) fail(`${location}#examples.${exampleId}.overrides`, `覆写引用了未知动作 ${actionId}`);
    }
  }
}

function validateEventLibrary(config) {
  const location = "public/游戏内容/随机事件/01-新手村.json";
  if (!Array.isArray(config?.randomEvents)) return;
  const eventIds = new Set();
  const itemIds = new Set(Object.keys(config.itemDefinitions ?? {}));
  for (const event of config.randomEvents) {
    if (eventIds.has(event.id)) fail(`${location}#randomEvents`, `事件 id 重复：${event.id}`);
    eventIds.add(event.id);
    if (!Array.isArray(event.choices) || event.choices.length === 0) fail(`${location}#${event.id}`, "事件必须至少有一个选项");
    for (const choice of event.choices ?? []) {
      const outcomes = choice.outcomes ? Object.values(choice.outcomes) : [choice.outcome];
      for (const outcome of outcomes) {
        for (const effect of outcome?.effects ?? []) {
          if (effect.type === "item" && !itemIds.has(effect.id)) fail(`${location}#${event.id}.${choice.id}`, `奖励引用了未知物品 ${effect.id}`);
        }
      }
    }
  }
  if (config.stage?.randomEventPoolSize !== config.randomEvents.length) {
    fail(`${location}#stage.randomEventPoolSize`, `配置为 ${config.stage?.randomEventPoolSize}，实际事件数为 ${config.randomEvents.length}`);
  }
  const finalCount = Math.max(...(config.mainlineProgression ?? [])
    .filter((item) => item.trigger?.type === "random_events_resolved")
    .map((item) => item.trigger.count ?? 0));
  if (finalCount !== config.stage?.randomEncountersPerLife) {
    fail(`${location}#mainlineProgression`, "最终主线事件数必须等于每世随机事件数，避免流程卡死");
  }
}

function validatePrologue(config) {
  const location = "public/游戏内容/序章规则.json";
  if (!config?.birth?.stats || !Array.isArray(config?.character?.origins)) {
    fail(location, "缺少出生属性或出身配置");
    return;
  }
  const points = config.birth.stats.allocationPoints;
  const maximum = config.birth.stats.allocationMaximumPerStat;
  if (!Number.isInteger(points) || points < 0) fail(`${location}#birth.stats.allocationPoints`, "命格点必须是非负整数");
  if (!Number.isInteger(maximum) || maximum < 1) fail(`${location}#birth.stats.allocationMaximumPerStat`, "单项投入上限必须是正整数");
  if (points > maximum * 5) fail(`${location}#birth.stats`, "命格点超过五项可投入的总上限，玩家将无法完成加点");

  const originIds = new Set();
  let totalWeight = 0;
  for (const origin of config.character.origins) {
    if (!origin.id || originIds.has(origin.id)) fail(`${location}#character.origins`, `出身 id 缺失或重复：${origin.id ?? "空"}`);
    originIds.add(origin.id);
    if (!Number.isFinite(origin.weight) || origin.weight <= 0) fail(`${location}#character.origins.${origin.id}.weight`, "Roll 权重必须是正数");
    totalWeight += Number(origin.weight) || 0;
    if (origin.hiddenTalentId && !config.character.hiddenTalents?.[origin.hiddenTalentId]) {
      fail(`${location}#character.origins.${origin.id}.hiddenTalentId`, `引用了未知隐藏天赋 ${origin.hiddenTalentId}`);
    }
  }
  if (totalWeight <= 0) fail(`${location}#character.origins`, "出身 Roll 总权重必须大于 0");
}

function validateFreeActionObjects(content, freeConfig) {
  const location = "public/游戏内容/自由行动/内容对象示例.json";
  if (!content || !freeConfig?.actions) return;
  const allObjects = [
    ...(content.npcs ?? []),
    ...(content.items ?? []),
    ...(content.locations ?? []),
  ];
  const ids = new Set();
  for (const object of allObjects) {
    if (!object.id) fail(location, "对象缺少 id");
    if (ids.has(object.id)) fail(location, `对象 id 重复：${object.id}`);
    ids.add(object.id);
    if (!(freeConfig.targetTypes ?? []).includes(object.type)) fail(`${location}#${object.id}`, `未知对象类型 ${object.type}`);
    if (object.state && !(freeConfig.objectTags?.state ?? []).includes(object.state)) fail(`${location}#${object.id}`, `未知对象状态 ${object.state}`);
    const allowedTags = new Set(freeConfig.objectTags?.[object.type] ?? []);
    for (const tag of object.tags ?? []) if (!allowedTags.has(tag)) fail(`${location}#${object.id}.tags`, `未知 ${object.type} 标签 ${tag}`);
    for (const actionId of [...(object.recommendedActions ?? []), ...(object.extraActions ?? [])]) {
      if (!freeConfig.actions[actionId]) fail(`${location}#${object.id}`, `引用了未知动作 ${actionId}`);
    }
    if ((object.recommendedActions ?? []).length > freeConfig.interface.recommendedActionLimit) {
      fail(`${location}#${object.id}`, `推荐动作不能超过 ${freeConfig.interface.recommendedActionLimit} 个`);
    }
    for (const [trait, value] of Object.entries(object.traits ?? {})) {
      if (!freeConfig.numericTraits?.[trait]) fail(`${location}#${object.id}.traits`, `未知数值特征 ${trait}`);
      if (!Number.isFinite(value) || value < 0 || value > 100) fail(`${location}#${object.id}.traits.${trait}`, "数值特征必须在 0—100 之间");
    }
    for (const overrideKey of Object.keys(object.overrides ?? {})) {
      const actionId = overrideKey.split(/[.@]/, 1)[0];
      if (!freeConfig.actions[actionId]) fail(`${location}#${object.id}.overrides`, `覆写引用了未知动作 ${actionId}`);
    }
  }

  for (const node of content.mainlineNodes ?? []) {
    for (const npcId of node.importantNpcIds ?? []) if (!ids.has(npcId)) fail(`${location}#${node.id}`, `主线引用了未知人物 ${npcId}`);
    for (const itemId of node.importantItemIds ?? []) if (!ids.has(itemId)) fail(`${location}#${node.id}`, `主线引用了未知物品 ${itemId}`);
    for (const route of freeConfig.mainlineSafety?.requiredContinuationRoutes ?? []) {
      if (!node.continuationRoutes?.[route]) fail(`${location}#${node.id}`, `缺少主线继续路线 ${route}`);
    }
  }
}

const files = await jsonFiles(contentRoot);
const parsed = new Map();
for (const file of files) parsed.set(path.normalize(file), await readJson(file));

const freeActionConfig = parsed.get(path.normalize(path.join(contentRoot, "自由行动", "自由行动规则.json")));
validateFreeActions(freeActionConfig);
validateFreeActionObjects(
  parsed.get(path.normalize(path.join(contentRoot, "自由行动", "内容对象示例.json"))),
  freeActionConfig,
);
validateEventLibrary(parsed.get(path.normalize(path.join(contentRoot, "随机事件", "01-新手村.json"))));
validatePrologue(parsed.get(path.normalize(path.join(contentRoot, "序章规则.json"))));

if (errors.length > 0) {
  console.error(`内容检查失败，共 ${errors.length} 项：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`内容检查通过：${files.length} 个 JSON，${Object.keys(parsed.get(path.normalize(path.join(contentRoot, "自由行动", "自由行动规则.json")))?.actions ?? {}).length} 个自由动作。`);
}
