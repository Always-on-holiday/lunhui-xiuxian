import type { FreeActionTarget } from "@/lib/free-actions";
import type { FiveStats, InventoryItem } from "@/lib/prologue";

export const STAT_LABELS: Array<{ key: keyof FiveStats; label: string }> = [
  { key: "attack", label: "攻击" },
  { key: "defense", label: "防御" },
  { key: "speed", label: "速度" },
  { key: "intelligence", label: "智力" },
  { key: "proficiency", label: "熟练" },
];

export const STAT_NAME = Object.fromEntries(
  STAT_LABELS.map((entry) => [entry.key, entry.label]),
) as Record<keyof FiveStats, string>;

export const HOSTILE_ACTIONS = new Set(["threaten", "steal", "rob", "attack", "kill", "infringe"]);
export const ITEM_ACTION_ORDER = ["inspect_item", "use_item", "eat_item", "equip_item", "combine_item", "give_item", "destroy_item", "discard_item"];
export const PLAYER_ACTION_ORDER = ["observe", "talk", "trade", "help", "threaten", "steal", "rob", "attack", "kill", "infringe", "leave"];

export const FREE_ACTION_OUTCOME_LABELS = {
  criticalSuccess: "大成",
  success: "成功",
  failure: "失败",
  criticalFailure: "惨败",
} as const;

export type ActionSelection = {
  key: string;
  target: FreeActionTarget;
  sourceItemId?: string;
  sourcePlayerId?: string;
  recommendedActions?: string[];
  extraActions?: string[];
};

export function itemTags(item: InventoryItem) {
  const text = `${item.name} ${item.category} ${item.description}`;
  const tags = new Set<string>(item.tags ?? []);
  if (/食|粮|肉|果|饼|汤/.test(text)) tags.add("food");
  if (/丹|药|草|灵植/.test(text)) tags.add("herb");
  if (/毒|腐|瘴/.test(text)) tags.add("toxic");
  if (/矿|石|铁|玉/.test(text)) tags.add("mineral");
  if (/剑|刀|枪|弓|武器|兵刃/.test(text)) tags.add("weapon");
  if (/甲|衣|袍|盾|护具/.test(text)) tags.add("armor");
  if (/符|印|令/.test(text)) tags.add("talisman");
  if (/戒|佩|坠|饰/.test(text)) tags.add("accessory");
  if (/信|钥|任务|凭证/.test(text)) tags.add("quest_key");
  return [...tags];
}
