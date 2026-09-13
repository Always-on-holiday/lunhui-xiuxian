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

function validateEventLibrary(config, freeActionConfig) {
  const location = "public/游戏内容/随机事件/01-新手村.json";
  if (!Array.isArray(config?.randomEvents)) return;
  const eventIds = new Set();
  const itemIds = new Set(Object.keys(config.itemDefinitions ?? {}));
  for (const event of config.randomEvents) {
    if (eventIds.has(event.id)) fail(`${location}#randomEvents`, `事件 id 重复：${event.id}`);
    eventIds.add(event.id);
    if (!Array.isArray(event.choices) || event.choices.length === 0) fail(`${location}#${event.id}`, "事件必须至少有一个选项");
    const interactable = event.interactable;
    if (interactable) {
      const objectLocation = `${location}#${event.id}.interactable`;
      if (!(freeActionConfig?.targetTypes ?? []).includes(interactable.type)) fail(objectLocation, `未知对象类型 ${interactable.type}`);
      if (interactable.state && !(freeActionConfig?.objectTags?.state ?? []).includes(interactable.state)) fail(objectLocation, `未知对象状态 ${interactable.state}`);
      const allowedTags = new Set(freeActionConfig?.objectTags?.[interactable.type] ?? []);
      for (const tag of interactable.tags ?? []) if (!allowedTags.has(tag)) fail(`${objectLocation}.tags`, `未知 ${interactable.type} 标签 ${tag}`);
      const actionIds = [...(interactable.recommendedActions ?? []), ...(interactable.extraActions ?? [])];
      for (const actionId of actionIds) {
        const action = freeActionConfig?.actions?.[actionId];
        if (!action) fail(objectLocation, `引用了未知动作 ${actionId}`);
        else if (!(action.targets ?? []).includes(interactable.type)) fail(objectLocation, `动作 ${actionId} 不能用于 ${interactable.type}`);
      }
      if ((interactable.recommendedActions ?? []).length > (freeActionConfig?.interface?.recommendedActionLimit ?? 0)) {
        fail(objectLocation, `推荐动作不能超过 ${freeActionConfig?.interface?.recommendedActionLimit ?? 0} 个`);
      }
      for (const [overrideKey, override] of Object.entries(interactable.overrides ?? {})) {
        const actionId = overrideKey.split(/[.@]/, 1)[0];
        if (!freeActionConfig?.actions?.[actionId]) fail(`${objectLocation}.overrides`, `覆写引用了未知动作 ${actionId}`);
        for (const effect of override.effects ?? []) {
          if (effect.type === "item" && !itemIds.has(effect.id)) fail(`${objectLocation}.overrides.${overrideKey}`, `效果引用了未知物品 ${effect.id}`);
          if (effect.type === "set_state" && !(freeActionConfig?.objectTags?.state ?? []).includes(effect.value)) fail(`${objectLocation}.overrides.${overrideKey}`, `效果引用了未知状态 ${effect.value}`);
        }
      }
    }
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

  const timeSystem = config.timeSystem;
  if (!timeSystem?.lifespan || !timeSystem?.costs) {
    fail(`${location}#timeSystem`, "缺少寿命与时间消耗配置");
    return;
  }
  for (const key of ["daysPerYear", "realSecondsPerDay", "startingAgeYears"]) {
    if (!Number.isFinite(timeSystem[key]) || timeSystem[key] <= 0) {
      fail(`${location}#timeSystem.${key}`, "必须是正数");
    }
  }
  if (!config.birth.stats || !(timeSystem.lifespan.physiqueStat in {
    attack: true,
    defense: true,
    speed: true,
    intelligence: true,
    proficiency: true,
  })) {
    fail(`${location}#timeSystem.lifespan.physiqueStat`, "必须引用有效五维");
  }
  if (!Number.isInteger(timeSystem.lifespan.revivalGraceDays) || timeSystem.lifespan.revivalGraceDays <= 0) {
    fail(`${location}#timeSystem.lifespan.revivalGraceDays`, "复活续命天数必须是正整数");
  }
  for (const [key, value] of Object.entries(timeSystem.costs)) {
    if (!Number.isInteger(value) || value < 0) {
      fail(`${location}#timeSystem.costs.${key}`, "耗时必须是非负整数天");
    }
  }
}

function validateReincarnation(config) {
  const location = "public/游戏内容/轮回规则.json";
  if (!config?.death || !Array.isArray(config?.soul?.actions) || !Array.isArray(config?.revival?.methods)) {
    fail(location, "缺少 death、soul.actions 或 revival.methods");
    return;
  }
  if (!Number.isInteger(config.death.deadlineDays) || config.death.deadlineDays < 1) {
    fail(`${location}#death.deadlineDays`, "复活期限必须是正整数");
  }
  for (const key of ["reviveHealthPercent", "reviveSpiritPercent", "minimumSpiritFloorPercent", "maximumDrainPercent"]) {
    if (!Number.isFinite(config.death[key]) || config.death[key] < 0 || config.death[key] > 100) {
      fail(`${location}#death.${key}`, "百分比必须在 0—100 之间");
    }
  }
  const actionIds = new Set();
  for (const action of config.soul.actions) {
    if (!action.id || actionIds.has(action.id)) fail(`${location}#soul.actions`, `行动 id 缺失或重复：${action.id ?? "空"}`);
    actionIds.add(action.id);
    if (!["none", "living"].includes(action.target)) fail(`${location}#soul.actions.${action.id}.target`, "目标只能是 none 或 living");
    if (!Number.isInteger(action.powerGain) || action.powerGain < 0 || action.powerGain > 2) fail(`${location}#soul.actions.${action.id}.powerGain`, "单次魂力收益必须是 0—2 的整数");
  }
  const methodIds = new Set();
  for (const method of config.revival.methods) {
    if (!method.id || methodIds.has(method.id)) fail(`${location}#revival.methods`, `复活方式 id 缺失或重复：${method.id ?? "空"}`);
    methodIds.add(method.id);
  }
  if (!config.revival.methods.some((method) => method.selfOnly)) fail(`${location}#revival.methods`, "至少需要一种残魂自行复活方式");
  if (!Array.isArray(config.revival.fateMarks) || config.revival.fateMarks.length === 0) fail(`${location}#revival.fateMarks`, "至少需要一条死亡命格");
  if (!config.cycleSecret?.requiredArtId || !config.inheritance?.legacyArts?.some((art) => art.id === config.cycleSecret.requiredArtId)) {
    fail(`${location}#cycleSecret.requiredArtId`, "二周目特殊剧情引用的功法必须存在于 legacyArts");
  }
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

function validateSideQuestChapter(config, eventConfig, prologueConfig) {
  const location = "public/游戏内容/支线/01-青石村.json";
  if (!config?.quest || !Array.isArray(config.quest.nodes)) {
    fail(location, "缺少支线任务或节点列表");
    return;
  }

  const knownEventIds = new Set((eventConfig?.randomEvents ?? []).map((event) => event.id));
  const knownItemIds = new Set([
    ...Object.keys(eventConfig?.itemDefinitions ?? {}),
    ...Object.keys(prologueConfig?.character?.items ?? {}),
    ...Object.keys(config.rewardDefinitions?.items ?? {}),
  ]);
  const knownTechniqueIds = new Set(Object.keys(config.rewardDefinitions?.techniques ?? {}));
  const knownMemoryIds = new Set(Object.keys(config.rewardDefinitions?.memories ?? {}));
  const knownNpcIds = new Set(Object.keys(config.characters ?? {}));
  const nodeIds = new Set();

  for (const thread of config.personalThreads ?? []) {
    if (!prologueConfig?.sideQuests?.[thread.id]) fail(`${location}#personalThreads.${thread.id}`, "未对应序章中的灵根支线");
    if (!Number.isInteger(thread.rootCount) || thread.rootCount < 1 || thread.rootCount > 5) {
      fail(`${location}#personalThreads.${thread.id}.rootCount`, "灵根数量必须是 1—5 的整数");
    }
  }

  for (const [itemId, link] of Object.entries(config.itemLinks ?? {})) {
    if (!knownItemIds.has(itemId)) fail(`${location}#itemLinks.${itemId}`, "引用了未知道具");
    const eventMatch = /随机事件\s+([a-z0-9_]+)/i.exec(link.source ?? "");
    if (eventMatch && !knownEventIds.has(eventMatch[1])) {
      fail(`${location}#itemLinks.${itemId}.source`, `引用了未知随机事件 ${eventMatch[1]}`);
    }
  }

  for (const node of config.quest.nodes) {
    if (!node.id || nodeIds.has(node.id)) fail(`${location}#quest.nodes`, `节点 id 缺失或重复：${node.id ?? "空"}`);
    nodeIds.add(node.id);
    if (!Array.isArray(node.choices) || node.choices.length < 2) fail(`${location}#${node.id}`, "每个节点至少需要两个选择");
    for (const npcId of node.npcIds ?? []) if (!knownNpcIds.has(npcId)) fail(`${location}#${node.id}.npcIds`, `引用了未知人物 ${npcId}`);
  }

  const externalLinks = new Set(config.rules?.externalLinkIds ?? []);
  for (const [itemId, link] of Object.entries(config.itemLinks ?? {})) {
    for (const target of link.links ?? []) {
      if (!nodeIds.has(target) && !externalLinks.has(target)) fail(`${location}#itemLinks.${itemId}.links`, `引用了未知联动节点 ${target}`);
    }
  }

  for (const node of config.quest.nodes) {
    const choiceIds = new Set();
    for (const choice of node.choices ?? []) {
      if (!choice.id || choiceIds.has(choice.id)) fail(`${location}#${node.id}.choices`, `选项 id 缺失或重复：${choice.id ?? "空"}`);
      choiceIds.add(choice.id);
      for (const requirement of choice.requirements ?? []) {
        if (requirement.type === "item" && !knownItemIds.has(requirement.id)) fail(`${location}#${node.id}.${choice.id}`, `条件引用了未知道具 ${requirement.id}`);
      }
      for (const nextId of [choice.nextNode, choice.successNextNode, choice.failureNextNode].filter(Boolean)) {
        if (!nodeIds.has(nextId)) fail(`${location}#${node.id}.${choice.id}`, `引用了未知后续节点 ${nextId}`);
      }
      for (const effect of choice.effects ?? []) {
        if (["item", "consume_item"].includes(effect.type) && !knownItemIds.has(effect.id)) fail(`${location}#${node.id}.${choice.id}`, `效果引用了未知道具 ${effect.id}`);
        if (effect.type === "technique" && !knownTechniqueIds.has(effect.id)) fail(`${location}#${node.id}.${choice.id}`, `效果引用了未知技法 ${effect.id}`);
        if (effect.type === "memory_candidate" && !knownMemoryIds.has(effect.id)) fail(`${location}#${node.id}.${choice.id}`, `效果引用了未知记忆 ${effect.id}`);
      }
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
const firstStageEvents = parsed.get(path.normalize(path.join(contentRoot, "随机事件", "01-新手村.json")));
const prologueConfig = parsed.get(path.normalize(path.join(contentRoot, "序章规则.json")));
validateEventLibrary(firstStageEvents, freeActionConfig);
validatePrologue(prologueConfig);
validateReincarnation(parsed.get(path.normalize(path.join(contentRoot, "轮回规则.json"))));
validateSideQuestChapter(
  parsed.get(path.normalize(path.join(contentRoot, "支线", "01-青石村.json"))),
  firstStageEvents,
  prologueConfig,
);

if (errors.length > 0) {
  console.error(`内容检查失败，共 ${errors.length} 项：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`内容检查通过：${files.length} 个 JSON，${Object.keys(parsed.get(path.normalize(path.join(contentRoot, "自由行动", "自由行动规则.json")))?.actions ?? {}).length} 个自由动作。`);
}
