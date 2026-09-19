"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  FREE_ACTION_OUTCOME_LABELS,
  HOSTILE_ACTIONS,
  itemTags,
  type ActionSelection,
} from "@/lib/client/action-selection";
import type { Player, Room, Session } from "@/lib/client/game-session";
import { currentRandomEvent, type EventLibraryConfig } from "@/lib/events";
import {
  freeActionActorFromLife,
  prepareFreeAction,
  previewFreeAction,
  resolveFreeAction,
  type FreeActionConfig,
  type FreeActionContext,
  type FreeActionTarget,
} from "@/lib/free-actions";
import { spendLifeTime } from "@/lib/longevity";
import type { PrologueConfig, PrologueLife } from "@/lib/prologue";

export type FreeActionNotice = { targetKey: string; text: string; danger: boolean };

type UseFreeActionsOptions = {
  session: Session | null;
  room: Room | null;
  life: PrologueLife | null;
  lifeExpired: boolean;
  eventConfig: EventLibraryConfig;
  freeActionConfig: FreeActionConfig;
  timeSystem: PrologueConfig["timeSystem"];
  persistLife: (life: PrologueLife) => void;
  advanceWorldTime: (days: number) => void;
  setActiveActionTarget: Dispatch<SetStateAction<string | null>>;
  setFreeActionNotice: Dispatch<SetStateAction<FreeActionNotice | null>>;
};

export function useFreeActions({
  session,
  room,
  life,
  lifeExpired,
  eventConfig,
  freeActionConfig,
  timeSystem,
  persistLife,
  advanceWorldTime,
  setActiveActionTarget,
  setFreeActionNotice,
}: UseFreeActionsOptions) {
  function itemActionSelection(item: NonNullable<PrologueLife["inventory"]>[number]): ActionSelection {
    const tags = itemTags(item);
    return {
      key: `item:${item.id}`,
      sourceItemId: item.id,
      target: {
        id: `item:${item.id}`,
        name: item.name,
        type: "item",
        level: life?.level ?? 1,
        baseDifficulty: Math.max(5, (life?.level ?? 1) + (item.consumable ? 2 : 6)),
        state: "carried",
        tags,
        traits: {
          complexity: tags.some((tag) => ["talisman", "weapon", "armor"].includes(tag)) ? 12 : 5,
          toxicity: tags.includes("toxic") ? 35 : tags.includes("herb") ? 8 : 0,
          durability: tags.includes("mineral") ? 35 : 10,
          concealment: 5,
        },
      },
    };
  }

  function playerActionSelection(player: Player): ActionSelection {
    return {
      key: `player:${player.id}`,
      sourcePlayerId: player.id,
      target: {
        id: `player:${player.id}`,
        name: player.name,
        type: "npc",
        level: Math.max(1, player.level),
        baseDifficulty: 10,
        relation: 0,
        state: player.lifeStatus,
        tags: ["neutral", "witness", ...(player.isHost ? ["important"] : [])],
        traits: { concealment: 5, alertness: 10, willpower: 10, bargaining: 5, courage: 10, suspicion: 5 },
      },
    };
  }

  function eventNpcActionSelection(): ActionSelection | null {
    if (!life) return null;
    const event = currentRandomEvent(life, eventConfig);
    const npc = event?.interactable;
    if (!event || !npc) return null;
    return {
      key: `event:${event.id}:${npc.id}`,
      target: {
        ...npc,
        state: life.freeActionTargetStates?.[npc.id] ?? npc.state,
        stats: npc.stats ? { ...npc.stats } : undefined,
        tags: [...npc.tags],
        traits: npc.traits ? { ...npc.traits } : undefined,
        overrides: npc.overrides ? { ...npc.overrides } : undefined,
      },
      recommendedActions: [...npc.recommendedActions],
      extraActions: [...npc.extraActions],
    };
  }

  function secondaryTargetFor(actionId: string, selection: ActionSelection): FreeActionTarget | undefined {
    if (!life || !session || !room) return undefined;
    if (actionId === "use_item") {
      return { id: session.playerId, name: session.name, type: "self", level: life.level, stats: life.stats, tags: [], state: "alive" };
    }
    if (actionId === "combine_item") {
      const otherItem = (life.inventory ?? []).find((item) => item.quantity > 0 && item.id !== selection.sourceItemId);
      return otherItem ? itemActionSelection(otherItem).target : undefined;
    }
    if (actionId === "give_item") {
      const otherPlayer = room.players.find((player) => player.id !== session.playerId && player.lifeStatus === "alive");
      return otherPlayer ? playerActionSelection(otherPlayer).target : undefined;
    }
    return undefined;
  }

  function freeActionContext(selection: ActionSelection, actionId: string): FreeActionContext | null {
    if (!life || life.deathState || lifeExpired || !session || !room) return null;
    const attemptKey = `${selection.key}:${actionId}`;
    const isHostilePvpAction = Boolean(selection.sourcePlayerId && HOSTILE_ACTIONS.has(actionId));
    const activeEvent = currentRandomEvent(life, eventConfig);
    return {
      actor: freeActionActorFromLife(session.playerId, life),
      target: selection.target,
      secondaryTarget: secondaryTargetFor(actionId, selection),
      world: {
        seed: `${room.code}:${room.createdAt}`,
        locationId: selection.key.startsWith("event:") && activeEvent ? activeEvent.id : "green-stone-village",
        locationTags: ["settlement", ...(selection.key.startsWith("event:") ? activeEvent?.tags ?? [] : [])],
        witnessCount: Math.max(0, room.players.filter((player) => player.lifeStatus === "alive").length - 2),
      },
      actionId,
      attemptCount: life.freeActionAttempts?.[attemptKey] ?? 0,
      override: isHostilePvpAction && !room.pvpEnabled
        ? { available: false, unavailableReason: "房主未开启 PVP，不能对其他玩家采取敌对行动。" }
        : undefined,
    };
  }

  function performFreeAction(selection: ActionSelection, actionId: string) {
    if (!life || life.deathState || lifeExpired || !session) return;
    const context = freeActionContext(selection, actionId);
    if (!context) return;
    const preview = previewFreeAction(context, freeActionConfig);
    if (!preview.available) {
      setFreeActionNotice({ targetKey: selection.key, text: preview.reason, danger: true });
      return;
    }
    if ((preview.requiresConfirmation || preview.lethalWarning) && !window.confirm(
      `${preview.actionName}「${selection.target.name}」？\n风险：${preview.riskLabel}\n预计成功率：${preview.chanceRange[0]}–${preview.chanceRange[1]}%\n此行动可能产生不可逆后果。`,
    )) return;

    const attemptKey = `${selection.key}:${actionId}`;
    const attemptNumber = life.freeActionAttempts?.[attemptKey] ?? 0;
    const resolution = resolveFreeAction(
      prepareFreeAction(context, `${session.playerId}:${attemptKey}:${attemptNumber}`),
      freeActionConfig,
    );
    const succeeded = resolution.outcome === "success" || resolution.outcome === "criticalSuccess";
    const sourceItem = selection.sourceItemId
      ? life.inventory?.find((item) => item.id === selection.sourceItemId)
      : undefined;
    const sourceTags = sourceItem ? itemTags(sourceItem) : [];
    const edible = sourceTags.some((tag) => ["food", "herb", "toxic"].includes(tag));
    const consumeItem = Boolean(selection.sourceItemId && (
      actionId === "discard_item"
      || (succeeded && actionId === "destroy_item")
      || (actionId === "eat_item" && edible)
      || (succeeded && actionId === "use_item"
        && life.inventory?.find((item) => item.id === selection.sourceItemId)?.consumable)
    ));
    const accumulatedMinutes = (life.freeActionWorldMinutes ?? 0) + resolution.costs.worldMinutes;
    const elapsedDays = Math.floor(accumulatedMinutes / (24 * 60));
    const ingestionDamage = actionId === "eat_item" && edible && !succeeded
      ? Math.max(2, Math.ceil((sourceItem?.toxicity ?? 10) / (resolution.outcome === "criticalFailure" ? 4 : 8)))
      : 0;
    let nextLife: PrologueLife = {
      ...life,
      currentHealth: Math.max(1, life.currentHealth - resolution.costs.health - ingestionDamage),
      currentSpirit: Math.max(0, life.currentSpirit - resolution.costs.spirit),
      spiritStones: Math.max(0, (life.spiritStones ?? 0) - resolution.costs.spiritStones),
      inventory: consumeItem
        ? (life.inventory ?? []).map((item) => item.id === selection.sourceItemId
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item)
        : life.inventory,
      freeActionAttempts: {
        ...(life.freeActionAttempts ?? {}),
        [attemptKey]: attemptNumber + 1,
      },
      freeActionWorldMinutes: accumulatedMinutes % (24 * 60),
    };
    for (const effect of resolution.effects) {
      if (effect.type === "set_flag" && typeof effect.id === "string") {
        const flagValue = typeof effect.value === "boolean" || typeof effect.value === "string" || typeof effect.value === "number"
          ? effect.value
          : true;
        nextLife = {
          ...nextLife,
          freeActionFlags: { ...(nextLife.freeActionFlags ?? {}), [effect.id]: flagValue },
          adventure: nextLife.adventure && typeof flagValue === "boolean"
            ? { ...nextLife.adventure, flags: { ...nextLife.adventure.flags, [effect.id]: flagValue } }
            : nextLife.adventure,
        };
      }
      if (effect.type === "set_state" && typeof effect.value === "string") {
        nextLife = {
          ...nextLife,
          freeActionTargetStates: { ...(nextLife.freeActionTargetStates ?? {}), [selection.target.id]: effect.value },
        };
      }
      if (effect.type === "item" && typeof effect.id === "string") {
        const definition = eventConfig.itemDefinitions[effect.id];
        if (definition) {
          const quantity = typeof effect.quantity === "number" ? Math.max(1, Math.round(effect.quantity)) : 1;
          const inventory = [...(nextLife.inventory ?? [])];
          const existingIndex = inventory.findIndex((item) => item.id === effect.id);
          if (existingIndex >= 0) inventory[existingIndex] = { ...inventory[existingIndex], quantity: inventory[existingIndex].quantity + quantity };
          else inventory.push({ ...definition, quantity, effects: definition.effects.map((itemEffect) => ({ ...itemEffect })) });
          nextLife = { ...nextLife, inventory };
        }
      }
    }
    if (elapsedDays > 0) nextLife = spendLifeTime(nextLife, elapsedDays, "自由行动", timeSystem);
    persistLife(nextLife);
    advanceWorldTime(elapsedDays);

    const handoff = resolution.nextSystem === "combat"
      ? resolution.combat?.lethal ? " 结果需要转入致死战斗。" : " 结果需要转入战斗。"
      : resolution.nextSystem === "dialogue" ? " 结果需要进入交谈界面。"
        : resolution.nextSystem === "trade" ? " 结果需要进入交易界面。" : "";
    const timeText = resolution.costs.worldMinutes > 0 ? ` 耗时 ${resolution.costs.worldMinutes} 分钟。` : "";
    setFreeActionNotice({
      targetKey: selection.key,
      text: `${FREE_ACTION_OUTCOME_LABELS[resolution.outcome]}（掷 ${resolution.roll}/${resolution.chance}）：${resolution.message}${ingestionDamage > 0 ? ` 药性有毒，气血 -${ingestionDamage}。` : ""}${handoff}${timeText}`,
      danger: resolution.outcome === "failure" || resolution.outcome === "criticalFailure" || resolution.nextSystem === "combat",
    });
    if (consumeItem && (nextLife.inventory?.find((item) => item.id === selection.sourceItemId)?.quantity ?? 0) <= 0) {
      setActiveActionTarget(null);
    }
  }

  return {
    itemActionSelection,
    playerActionSelection,
    eventNpcActionSelection,
    freeActionContext,
    performFreeAction,
  };
}
