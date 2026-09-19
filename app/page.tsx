"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, ChevronDown, Dices, Ghost, MousePointer2, ScrollText, Sparkles, Swords, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EventScene } from "@/components/event-scene";
import { BirthFlow } from "@/components/birth-flow";
import { CycleSecretScene, InheritanceScene, SoulScene } from "@/components/reincarnation-scenes";
import { LandingScreen } from "@/components/game/landing-screen";
import { CharacterPanel } from "@/components/game/character-panel";
import { JudgementPanel } from "@/components/game/judgement-panel";
import { InventoryPanel } from "@/components/game/inventory-panel";
import { CompanionsPanel } from "@/components/game/companions-panel";
import { SidebarNavigation, type SidebarView } from "@/components/game/sidebar-navigation";
import { WorldHeader } from "@/components/game/world-header";
import { useGameContent } from "@/hooks/use-game-content";
import { useMultiplayerRoom } from "@/hooks/use-multiplayer-room";
import { useLocalLife } from "@/hooks/use-local-life";
import { useFreeActions, type FreeActionNotice } from "@/hooks/use-free-actions";
import {
  ITEM_ACTION_ORDER,
  PLAYER_ACTION_ORDER,
  STAT_NAME,
  type ActionSelection,
} from "@/lib/client/action-selection";
import {
  continueVillageAdventure,
  currentRandomEvent,
  resolveEventChoice,
  startVillageAdventure,
  toggleEventItem,
} from "@/lib/events";
import {
  canTriggerSideQuest,
  adjustBirthStat,
  advanceBirthStep,
  chooseTraining,
  currentBirthStep,
  finalizeBirthStats,
  type FiveStats,
  itemWorksInContext,
  resolveWoodenTrial,
  rollBirth,
  toggleTrialItem,
  triggerSideQuest,
} from "@/lib/prologue";
import { previewFreeAction } from "@/lib/free-actions";
import {
  isLifeExpired,
  renewLifeAfterRevival,
  spendLifeTime,
} from "@/lib/longevity";
import {
  applyPendingSpiritLoss,
  completeCycleSecret,
  enterSoulState,
  isSoulExpired,
  recordSoulAction,
  resolveCycleSecret,
  reviveLife,
  shouldShowCycleSecret,
  type LifeInheritance,
  type RevivalMethodConfig,
  type SoulActionConfig,
} from "@/lib/reincarnation";

export default function Home() {
  const {
    content,
    prologueConfig,
    eventConfig,
    eventEngineConfig,
    reincarnationConfig,
    freeActionConfig,
  } = useGameContent();
  const {
    name,
    setName,
    roomCode,
    setRoomCode,
    pvpEnabled,
    setPvpEnabled,
    session,
    room,
    setRoom,
    busy,
    error,
    setError,
    copied,
    createRoom,
    joinRoom,
    performRoomAction,
    copyInvite,
    clearSession,
  } = useMultiplayerRoom();
  const [itemNotice, setItemNotice] = useState("");
  const {
    life,
    pastLives,
    persistLife,
    archiveCurrentLife,
    resetAllLives,
  } = useLocalLife({
    session,
    timeSystem: prologueConfig.timeSystem,
    setNotice: setItemNotice,
  });
  const [lifeActionBusy, setLifeActionBusy] = useState(false);
  const [activeActionTarget, setActiveActionTarget] = useState<string | null>(null);
  const [freeActionNotice, setFreeActionNotice] = useState<FreeActionNotice | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("character");
  const [pendingEventChoice, setPendingEventChoice] = useState<{ drawId: string; choiceId: string } | null>(null);
  const [eventDiceRolling, setEventDiceRolling] = useState(false);
  const [eventResolutionReady, setEventResolutionReady] = useState(true);
  const [trialAwaitingRoll, setTrialAwaitingRoll] = useState(false);
  const [trialDiceRolling, setTrialDiceRolling] = useState(false);
  const sideQuestUnlocked = life ? canTriggerSideQuest(life) : false;
  const activeBirthStep = life ? currentBirthStep(life) : null;
  const statAllocationReady = activeBirthStep === null || activeBirthStep === "ready";
  const lifeExpired = isLifeExpired(life);
  const remainingLifeDays = life?.timeline
    ? Math.max(0, life.timeline.lifespanDays - life.timeline.ageDays)
    : null;
  const remainingLifePercent = life?.timeline && life.timeline.lifespanDays > 0
    ? Math.max(0, Math.min(100, remainingLifeDays! / life.timeline.lifespanDays * 100))
    : 0;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await createRoom(name, pvpEnabled);
    } catch {
      // The shared action already presents the error.
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    try {
      await joinRoom(name, roomCode);
    } catch {
      // The shared action already presents the error.
    }
  }

  const advanceWorldTime = useCallback((days: number) => {
    if (days <= 0) return;
    void performRoomAction({ action: "advance_time", days }).catch(() => {
      setItemNotice("此行动消耗的时间暂未同步到世界历，请稍后再试。");
    });
  }, [performRoomAction]);

  const {
    itemActionSelection,
    playerActionSelection,
    eventNpcActionSelection,
    freeActionContext,
    performFreeAction,
  } = useFreeActions({
    session,
    room,
    life,
    lifeExpired,
    eventConfig,
    freeActionConfig,
    timeSystem: prologueConfig.timeSystem,
    persistLife,
    advanceWorldTime,
    setActiveActionTarget,
    setFreeActionNotice,
  });

  useEffect(() => {
    if (!session || !life || life.deathState) return;
    const timer = window.setTimeout(() => {
      void performRoomAction({
        action: "sync",
        realm: life.realm,
        level: life.level,
        currentSpirit: life.currentSpirit,
        maxSpirit: life.maxSpirit,
      }).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [life, performRoomAction, session]);

  useEffect(() => {
    if (!session || !room || !life) return;
    const timer = window.setTimeout(() => {
      const player = room.players.find((candidate) => candidate.id === session.playerId);
      if (!player) return;
      if (player.lifeStatus === "soul" && !life.deathState) {
        const restoredSoul = enterSoulState(life, player.deathDay ?? room.worldDay, reincarnationConfig);
        persistLife({
          ...restoredSoul,
          deathState: restoredSoul.deathState ? {
            ...restoredSoul.deathState,
            deadlineDay: player.reviveDeadlineDay ?? restoredSoul.deathState.deadlineDay,
            soulPower: player.soulPower,
            lastActionDay: player.lastSoulActionDay ?? undefined,
          } : undefined,
        });
        return;
      }
      if (player.lifeStatus === "rebirth" && (life.cycle ?? 1) < room.cycle) {
        archiveCurrentLife(life);
        return;
      }
      if (player.lifeStatus === "alive" && life.deathState) {
        persistLife(renewLifeAfterRevival(
          reviveLife(life, reincarnationConfig),
          prologueConfig.timeSystem,
        ));
        setItemNotice("招魂成功。你已回到死亡前的境界，并获得一条死亡命格。");
        return;
      }
      if (player.pendingSpiritLoss > 0 && !life.deathState) {
        persistLife(applyPendingSpiritLoss(life, player.pendingSpiritLoss));
        setItemNotice(`残魂牵走了 ${player.pendingSpiritLoss} 点灵力。`);
        setRoom({ ...room, players: room.players.map((candidate) => candidate.id === player.id ? { ...candidate, pendingSpiritLoss: 0 } : candidate) });
        void performRoomAction({ action: "ack_effects" }).catch(() => undefined);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [archiveCurrentLife, life, performRoomAction, persistLife, prologueConfig.timeSystem, reincarnationConfig, room, session, setRoom]);

  function beginLife(inheritance?: LifeInheritance) {
    const cycle = room?.cycle ?? 1;
    persistLife(rollBirth(prologueConfig, inheritance, cycle));
    void performRoomAction({ action: "begin_life" }).catch(() => undefined);
  }

  function beginSideQuest() {
    if (!life || !statAllocationReady || life.deathState || lifeExpired) return;
    const days = prologueConfig.timeSystem.costs.sideQuestDays;
    persistLife(spendLifeTime(
      triggerSideQuest(life),
      days,
      "追查支线",
      prologueConfig.timeSystem,
    ));
    advanceWorldTime(days);
  }

  function selectTraining(choiceId: string) {
    if (!life || !statAllocationReady || life.deathState || lifeExpired) return;
    const days = prologueConfig.timeSystem.costs.trainingDays;
    persistLife(spendLifeTime(
      chooseTraining(life, choiceId, prologueConfig.training.choices),
      days,
      "童年修炼",
      prologueConfig.timeSystem,
    ));
    advanceWorldTime(days);
  }

  function changeBirthStat(stat: keyof FiveStats, direction: 1 | -1) {
    if (!life) return;
    persistLife(adjustBirthStat(
      life,
      stat,
      direction,
      prologueConfig.birth.stats.allocationMaximumPerStat ?? 3,
    ));
  }

  function confirmBirthStats() {
    if (!life) return;
    persistLife(finalizeBirthStats(life));
  }

  function continueBirthFlow() {
    if (!life || life.deathState || lifeExpired) return;
    const days = prologueConfig.timeSystem.costs.birthStepDays;
    persistLife(spendLifeTime(
      advanceBirthStep(life),
      days,
      "入世定命",
      prologueConfig.timeSystem,
    ));
    advanceWorldTime(days);
  }

  function prepareTrialItem(itemId: string) {
    const item = life?.inventory?.find((candidate) => candidate.id === itemId);
    if (!life || !item) return;
    if (!itemWorksInContext(item, prologueConfig.trial.contextId)) {
      setItemNotice(prologueConfig.character.uselessItemTemplate.replace("{item}", item.name));
      return;
    }
    const alreadySelected = life.selectedTrialItemIds?.includes(itemId) ?? false;
    persistLife(toggleTrialItem(life, itemId, prologueConfig.trial.contextId));
    const template = alreadySelected
      ? prologueConfig.character.unselectedItemTemplate
      : prologueConfig.character.usefulItemTemplate;
    setItemNotice(template.replace("{item}", item.name));
  }

  function startTrial() {
    if (!life?.training || life.deathState || lifeExpired) return;
    setItemNotice("");
    setTrialAwaitingRoll(true);
  }

  async function rollTrial(forcedRoll?: number) {
    if (!life?.training || life.deathState || lifeExpired || !trialAwaitingRoll || trialDiceRolling) return;
    setTrialDiceRolling(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
    const fateRoll = forcedRoll ?? Math.floor(Math.random() * 10) + 1;
    const resolved = resolveWoodenTrial(life, prologueConfig.trial, fateRoll);
    const days = prologueConfig.timeSystem.costs.trialDays;
    persistLife(spendLifeTime(
      resolved,
      days,
      "木傀试炼",
      prologueConfig.timeSystem,
    ));
    advanceWorldTime(days);
    setTrialAwaitingRoll(false);
    setTrialDiceRolling(false);
  }

  function continueAfterTrial() {
    if (!life?.battle || life.battle.outcome === "defeat" || life.adventure) return;
    persistLife(startVillageAdventure(life, eventConfig, eventEngineConfig));
  }

  function prepareEventItem(itemId: string) {
    if (!life?.adventure) return;
    const item = life.inventory?.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const selected = life.adventure.selectedItemIds.includes(itemId);
    persistLife(toggleEventItem(life, itemId));
    setItemNotice(selected
      ? `已收回「${item.name}」。`
      : `已备好「${item.name}」，结算时会自动判断是否有用。`);
  }

  function chooseEvent(choiceId: string) {
    if (!life?.adventure || life.deathState || lifeExpired) return;
    const event = currentRandomEvent(life, eventConfig);
    if (!event?.choices.some((choice) => choice.id === choiceId) || !life.adventure.currentDrawId) return;
    setItemNotice("");
    setPendingEventChoice({ drawId: life.adventure.currentDrawId, choiceId });
  }

  async function rollEventChoice() {
    if (!life?.adventure || life.deathState || lifeExpired || eventDiceRolling || !pendingEventChoice) return;
    if (pendingEventChoice.drawId !== life.adventure.currentDrawId) return;
    const choiceId = pendingEventChoice.choiceId;
    setEventDiceRolling(true);
    setEventResolutionReady(false);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
      const resolvedLife = spendLifeTime(
        resolveEventChoice(life, eventConfig, choiceId, eventEngineConfig),
        prologueConfig.timeSystem.costs.randomEventDays,
        "经历随机事件",
        prologueConfig.timeSystem,
      );
      persistLife(resolvedLife);
      advanceWorldTime(prologueConfig.timeSystem.costs.randomEventDays);
      setPendingEventChoice(null);
      window.setTimeout(() => setEventResolutionReady(true), 3000);
    } finally {
      setEventDiceRolling(false);
    }
  }

  function continueEvent() {
    if (!life?.adventure) return;
    setItemNotice("");
    setPendingEventChoice(null);
    setEventDiceRolling(false);
    setEventResolutionReady(true);
    persistLife(continueVillageAdventure(life, eventConfig, eventEngineConfig));
  }

  function renderFreeActionMenu(selection: ActionSelection) {
    if (!life || life.deathState || lifeExpired || activeActionTarget !== selection.key) return null;
    const order = selection.recommendedActions
      ? [...selection.recommendedActions, ...(selection.extraActions ?? [])]
      : selection.target.type === "item" ? ITEM_ACTION_ORDER : PLAYER_ACTION_ORDER;
    const actions = order.filter((actionId) => freeActionConfig.actions[actionId]?.targets.includes(selection.target.type));
    const recommendedCount = selection.recommendedActions?.length ?? freeActionConfig.interface.recommendedActionLimit;
    const primary = actions.slice(0, recommendedCount);
    const extra = actions.slice(recommendedCount);
    const renderActions = (actionIds: string[]) => (
      <div className="grid gap-2 sm:grid-cols-2">
        {actionIds.map((actionId) => {
          const context = freeActionContext(selection, actionId);
          if (!context) return null;
          const preview = previewFreeAction(context, freeActionConfig);
          return (
            <button
              key={actionId}
              type="button"
              disabled={!preview.available}
              title={preview.available ? undefined : preview.reason}
              onClick={() => performFreeAction(selection, actionId)}
              className="rounded border border-[#3b584a] bg-[#102019] px-3 py-2 text-left transition hover:border-[#b99a56] hover:bg-[#17352c] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="block text-sm text-[#e6d8ad]">{preview.actionName}</span>
              <span className="mt-1 block text-xs text-[#7f9288]">
                {preview.available
                  ? `${preview.riskLabel} · ${preview.chanceRange[0]}–${preview.chanceRange[1]}%${preview.primaryStat ? ` · ${STAT_NAME[preview.primaryStat]}` : ""}`
                  : preview.reason}
              </span>
            </button>
          );
        })}
      </div>
    );
    return (
      <div className="mt-3 border-t border-[#2b4439] pt-3" onClick={(event) => event.stopPropagation()}>
        <p className="mb-2 flex items-center gap-2 text-xs text-[#aebdb5]"><MousePointer2 className="h-3.5 w-3.5" />选择对「{selection.target.name}」的行为</p>
        {renderActions(primary)}
        {extra.length > 0 && (
          <details className="mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-[#82968c]">
              <ChevronDown className="h-3.5 w-3.5" />{freeActionConfig.interface.extraActionsLabel}
            </summary>
            <div className="mt-2">{renderActions(extra)}</div>
          </details>
        )}
        {freeActionNotice?.targetKey === selection.key && (
          <p className={`mt-3 rounded border px-3 py-2 text-sm leading-6 ${freeActionNotice.danger ? "border-[#73443b] bg-[#2a1714] text-[#e8a190]" : "border-[#486a58] bg-[#10241c] text-[#b8d8c7]"}`}>
            {freeActionNotice.text}
          </p>
        )}
      </div>
    );
  }

  function renderEventNpcActions(selection: ActionSelection) {
    const stateLabels: Record<string, string> = {
      wounded: "重伤",
      alive: "伤势已稳",
      hostile: "敌对",
      looted: "包袱已失",
      missing: "已离开",
      dead: "已死亡",
    };
    return (
      <div className="mt-5 rounded-md border border-[#44533c] bg-[#101910] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 text-left"
          aria-expanded={activeActionTarget === selection.key}
          onClick={() => {
            setActiveActionTarget((current) => current === selection.key ? null : selection.key);
            setFreeActionNotice(null);
          }}
        >
          <span>
            <span className="flex items-center gap-2 text-[#e7d399]"><Users className="h-4 w-4" />事件人物 · {selection.target.name}</span>
            <span className="mt-1 block text-xs text-[#82968c]">
              {stateLabels[selection.target.state ?? ""] ?? selection.target.state ?? "状态未知"} · 点击选择自由行动
            </span>
          </span>
          <span className="rounded-full border border-[#5d6848] px-3 py-1 text-xs text-[#cbb875]">自由行动</span>
        </button>
        {renderFreeActionMenu(selection)}
      </div>
    );
  }

  async function testPlayerDeath() {
    if (!life || !room || life.deathState || lifeActionBusy) return;
    const deadLife = enterSoulState(life, room.worldDay, reincarnationConfig);
    persistLife(deadLife);
    setLifeActionBusy(true);
    try {
      await performRoomAction({ action: "die", deadlineDays: reincarnationConfig.death.deadlineDays });
      setItemNotice("");
    } catch (caught) {
      persistLife(life);
      setItemNotice(caught instanceof Error ? caught.message : "归魂失败。");
    } finally {
      setLifeActionBusy(false);
    }
  }

  async function performSoulAction(action: SoulActionConfig, targetId?: string) {
    if (!life?.deathState || !room || lifeActionBusy) return;
    const expired = isSoulExpired(life.deathState, room.worldDay);
    const target = room.players.find((player) => player.id === targetId);
    setLifeActionBusy(true);
    try {
      const result = await performRoomAction({
        action: "soul_action",
        actionId: action.id,
        targetId,
        powerGain: action.powerGain,
        spiritDrain: (action.baseSpiritDrain ?? 0) + (expired ? action.expiredSpiritDrainBonus ?? 0 : 0),
        floorPercent: reincarnationConfig.death.minimumSpiritFloorPercent,
        maximumPercent: reincarnationConfig.death.maximumDrainPercent,
      });
      persistLife(recordSoulAction(life, action, room.worldDay, result.soulPower ?? life.deathState.soulPower + action.powerGain, target?.name));
      setItemNotice(action.id === "siphon"
        ? result.drained
          ? `从「${target?.name ?? "生者"}」处牵引了 ${result.drained} 点灵力。`
          : "对方的灵力已接近安全线，本次没有吸取到灵力。"
        : action.resultText);
    } catch (caught) {
      setItemNotice(caught instanceof Error ? caught.message : "残魂行动失败。");
    } finally {
      setLifeActionBusy(false);
    }
  }

  function canPayRevival(method: RevivalMethodConfig) {
    if (!life) return false;
    const cost = method.actorCost;
    if (!cost) return true;
    if ((cost.spiritStones ?? 0) > (life.spiritStones ?? 0)) return false;
    if ((cost.spirit ?? 0) > life.currentSpirit) return false;
    if (cost.itemId) {
      const item = life.inventory?.find((candidate) => candidate.id === cost.itemId);
      if (!item || item.quantity < (cost.itemQuantity ?? 1)) return false;
    }
    return true;
  }

  async function revivePlayer(targetId: string, method: RevivalMethodConfig) {
    if (!life || !room || lifeActionBusy || !canPayRevival(method)) return;
    const target = room.players.find((player) => player.id === targetId);
    const expired = Boolean(target?.reviveDeadlineDay && room.worldDay > target.reviveDeadlineDay);
    const soulPowerCost = expired ? method.expiredSoulPowerCost ?? method.soulPowerCost : method.soulPowerCost;
    setLifeActionBusy(true);
    try {
      await performRoomAction({
        action: "revive",
        targetId,
        selfOnly: method.selfOnly === true,
        soulPowerCost,
      });
      if (!method.selfOnly) {
        const cost = method.actorCost ?? {};
        persistLife({
          ...life,
          spiritStones: Math.max(0, (life.spiritStones ?? 0) - (cost.spiritStones ?? 0)),
          currentSpirit: Math.max(0, life.currentSpirit - (cost.spirit ?? 0)),
          inventory: (life.inventory ?? []).map((item) => item.id === cost.itemId
            ? { ...item, quantity: Math.max(0, item.quantity - (cost.itemQuantity ?? 1)) }
            : item),
        });
      }
      setItemNotice(method.selfOnly ? "魂魄重新归位，正在恢复此身。" : `已经以「${method.title}」复活了${target ? `「${target.name}」` : "同伴"}。`);
    } catch (caught) {
      setItemNotice(caught instanceof Error ? caught.message : "招魂失败。");
    } finally {
      setLifeActionBusy(false);
    }
  }

  function beginInheritedLife(selection: { artId?: string; itemId?: string; memoryId?: string }) {
    const archivedLives = pastLives.map((entry) => entry.life);
    const inheritedArts = archivedLives.flatMap((entry) => entry.cultivationArts ?? []);
    const legacyArts = reincarnationConfig.inheritance.legacyArts.filter((art) => (
      !art.unlock?.stageComplete || archivedLives.some((entry) => entry.adventure?.stageComplete)
    ));
    const items = archivedLives.flatMap((entry) => (entry.inventory ?? []).filter((item) => item.quantity > 0));
    const inheritance: LifeInheritance = {
      cultivationArt: [...inheritedArts, ...legacyArts].find((entry) => entry.id === selection.artId),
      item: items.find((entry) => entry.id === selection.itemId),
      memory: reincarnationConfig.inheritance.memories.find((entry) => entry.id === selection.memoryId),
    };
    beginLife(inheritance);
  }

  function chooseCycleSecret(choiceId: string) {
    if (!life) return;
    persistLife(resolveCycleSecret(life, choiceId, reincarnationConfig));
  }

  function finishCycleSecret() {
    if (!life) return;
    persistLife(completeCycleSecret(life));
  }

  async function leaveRoom() {
    if (session) {
      await fetch(`/api/rooms/${session.code}?playerId=${encodeURIComponent(session.playerId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    clearSession();
    setError("");
  }

  useEffect(() => {
    const diedFromInjury = Boolean(life && life.currentHealth <= 0);
    const diedFromOldAge = isLifeExpired(life);
    if (!life || !room || (!diedFromInjury && !diedFromOldAge) || life.deathState || lifeActionBusy) return;
    const timer = window.setTimeout(() => {
      const deadLife = enterSoulState(life, room.worldDay, reincarnationConfig);
      persistLife(deadLife);
      if (diedFromOldAge) setItemNotice("阳寿耗尽，魂魄离体。你仍可作为残魂行动并等待复活。");
      setLifeActionBusy(true);
      void performRoomAction({ action: "die", deadlineDays: reincarnationConfig.death.deadlineDays })
        .catch((caught) => setItemNotice(caught instanceof Error ? caught.message : "归魂失败。"))
        .finally(() => setLifeActionBusy(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [life, lifeActionBusy, performRoomAction, persistLife, reincarnationConfig, room]);

  if (session && room) {
    const ownPlayer = room.players.find((player) => player.id === session.playerId);
    const archivedLives = pastLives.map((entry) => entry.life);
    const inheritanceArts = [
      ...archivedLives.flatMap((entry) => entry.cultivationArts ?? []),
      ...reincarnationConfig.inheritance.legacyArts.filter((art) => (
        !art.unlock?.stageComplete || archivedLives.some((entry) => entry.adventure?.stageComplete)
      )),
    ].filter((art, index, values) => values.findIndex((candidate) => candidate.id === art.id) === index);
    const inheritanceItems = archivedLives
      .flatMap((entry) => (entry.inventory ?? []).filter((item) => item.quantity > 0))
      .filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
    const awaitingInheritance = !life && room.cycle > 1 && pastLives.length > 0;
    const activeEventNpc = eventNpcActionSelection();
    const activeEvent = life?.adventure ? currentRandomEvent(life, eventConfig) : null;
    const validPendingEventChoice = pendingEventChoice?.drawId === life?.adventure?.currentDrawId
      ? pendingEventChoice
      : null;
    const pendingEventChoiceText = activeEvent?.choices.find((choice) => choice.id === validPendingEventChoice?.choiceId)?.text;
    const inventoryItemCount = (life?.inventory ?? []).reduce((total, item) => total + Math.max(0, item.quantity), 0);
    return (
      <main className="world-grid min-h-screen px-3 py-3 sm:px-5 lg:h-screen lg:overflow-hidden lg:px-7">
        <div className="mx-auto max-w-[1480px]">
          <WorldHeader
            content={content}
            room={room}
            daysPerYear={prologueConfig.timeSystem.daysPerYear}
            remainingLifeDays={remainingLifeDays}
            remainingLifePercent={remainingLifePercent}
            lifeExpired={lifeExpired}
            copied={copied}
            onCopyInvite={() => void copyInvite()}
            onLeave={() => void leaveRoom()}
          />

          <div className="grid gap-4 lg:h-[calc(100vh-5.25rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.78fr)] lg:overflow-hidden">
            <section className="ink-panel min-h-[540px] rounded-lg border border-[#29443a] p-5 lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-color:#3b584a_#08130f] lg:[scrollbar-width:thin]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs tracking-[0.18em] text-[#7ea28f]">{content.world.location}</p>
                    <h1 className="mt-1 text-xl text-[#f4e8c5] sm:text-2xl">
                    {life?.deathState
                      ? `残魂未散 · 第 ${room.cycle} 世`
                      : life?.adventure
                      ? `${life.adventure.stageName} · 第 ${room.cycle} 世`
                      : life
                        ? `第 ${room.cycle} 世，从出生开始`
                        : "命数未定，静候降生"}
                  </h1>
                </div>
                {life ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {!life.deathState && statAllocationReady && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button title={reincarnationConfig.death.testDeathHint} aria-label={reincarnationConfig.death.testDeathButton} variant="outline" size="icon-sm" className="border-[#66516f] bg-transparent text-[#b8a4c1] hover:bg-[#211629] hover:text-white">
                            <Ghost className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-[#5e4a68] bg-[#120d17] text-[#e8e0eb]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-[#eadcf0]">{reincarnationConfig.death.confirmTitle}</AlertDialogTitle>
                            <AlertDialogDescription className="leading-6 text-[#aa9caf]">
                              {reincarnationConfig.death.confirmText}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-[#52435a] bg-transparent text-[#c1b3c6] hover:bg-[#211629] hover:text-white">
                              {content.world.cancelButton}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={testPlayerDeath} className="bg-[#745783] text-white hover:bg-[#866395]">
                              <Ghost className="h-4 w-4" />
                              {reincarnationConfig.death.confirmButton}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {!life.deathState && <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm" title={content.world.resetAllButton} aria-label={content.world.resetAllButton} className="text-[#b17e75] hover:bg-[#321d19] hover:text-[#f1b2a5]">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-[#69443e] bg-[#180e0c] text-[#eee5e2]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-[#f0b5a9]">{content.world.resetAllConfirmTitle}</AlertDialogTitle>
                          <AlertDialogDescription className="leading-6 text-[#bda39d]">
                            {content.world.resetAllConfirmText}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-[#5b433e] bg-transparent text-[#c1b2ae] hover:bg-[#281714] hover:text-white">
                            {content.world.cancelButton}
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={resetAllLives} className="bg-[#a95043] text-white hover:bg-[#bd6052]">
                            {content.world.resetAllConfirmButton}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>}
                  </div>
                ) : (
                  <Sparkles className="slow-pulse h-6 w-6 text-[#d6b66d]" />
                )}
              </div>
              <div className="gold-rule my-4 h-px" />
              {itemNotice && (
                <p className="mb-5 rounded border border-[#5e4d31] bg-[#201b10] px-3 py-2 text-sm leading-6 text-[#ddc486]">
                  {itemNotice}
                </p>
              )}

              {!life ? (
                awaitingInheritance ? (
                  <InheritanceScene
                    cycle={room.cycle}
                    config={reincarnationConfig}
                    arts={inheritanceArts}
                    items={inheritanceItems}
                    memories={reincarnationConfig.inheritance.memories}
                    onBegin={beginInheritedLife}
                  />
                ) : (
                <div className="space-y-4">
                  <p className="max-w-2xl text-base leading-8 text-[#b8c5bd]">
                    {prologueConfig.intro.description}
                  </p>
                  <div className="rounded-md border border-[#2d483d] bg-[#08120f]/80 p-5">
                    <p className="text-sm text-[#789087]">{prologueConfig.intro.flowLabel}</p>
                    <p className="mt-2 leading-7 text-[#d9dfd7]">{prologueConfig.intro.flowText}</p>
                  </div>
                  {pastLives.length > 0 && (
                    <details className="rounded-md border border-[#3b513f] bg-[#0b1813] p-4">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-[#c8d3cc]">
                        <Archive className="h-4 w-4 text-[#d6b66d]" />
                        {content.world.pastLivesLabel} · {pastLives.length} {content.world.pastLivesSaved}
                      </summary>
                      <div className="mt-4 space-y-2 border-t border-[#29443a] pt-4">
                        {[...pastLives].reverse().slice(0, 5).map((entry, index) => (
                          <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#263d34] px-3 py-2 text-sm">
                            <span className="text-[#dfcf9f]">
                              第 {pastLives.length - index} 世 · {entry.life.realm} {entry.life.level} 级 · {entry.life.root.name}
                            </span>
                            <span className="text-xs text-[#71847a]">
                              履历 {entry.life.adventure?.history.length ?? 0} 条
                            </span>
                          </div>
                        ))}
                        <p className="text-xs text-[#71847a]">{content.world.nextLifeHint}</p>
                      </div>
                    </details>
                  )}
                  <div className="flex justify-center py-8 sm:py-10">
                    <Button onClick={() => beginLife()} className="h-14 bg-[#d6b66d] px-10 text-base text-[#102019] shadow-[0_8px_24px_rgba(214,182,109,0.12)] hover:bg-[#e7cc8b]">
                      <Dices className="h-5 w-5" />
                      {prologueConfig.intro.rollButton}
                    </Button>
                  </div>
                </div>
                )
              ) : life.deathState ? (
                <SoulScene
                  life={life}
                  worldDay={room.worldDay}
                  players={room.players}
                  currentPlayerId={session.playerId}
                  config={reincarnationConfig}
                  busy={lifeActionBusy}
                  onAct={performSoulAction}
                  onSelfRevive={() => {
                    const method = reincarnationConfig.revival.methods.find((candidate) => candidate.selfOnly);
                    if (method) void revivePlayer(session.playerId, method);
                  }}
                />
              ) : statAllocationReady && shouldShowCycleSecret(life, reincarnationConfig) ? (
                <CycleSecretScene
                  life={life}
                  config={reincarnationConfig}
                  onChoose={chooseCycleSecret}
                  onContinue={finishCycleSecret}
                />
              ) : life.adventure ? (
                <EventScene
                  life={life}
                  config={eventConfig}
                  timeCostDays={prologueConfig.timeSystem.costs.randomEventDays}
                  npcActions={activeEventNpc ? renderEventNpcActions(activeEventNpc) : undefined}
                  pendingChoiceId={validPendingEventChoice?.choiceId}
                  rolling={eventDiceRolling}
                  resolutionReady={eventResolutionReady}
                  onChoose={chooseEvent}
                  onContinue={continueEvent}
                />
              ) : (
                <div className="space-y-4">
                  {activeBirthStep && activeBirthStep !== "ready" ? (
                    <BirthFlow
                      life={life}
                      config={prologueConfig}
                      step={activeBirthStep}
                      timeCostDays={prologueConfig.timeSystem.costs.birthStepDays}
                      onContinue={continueBirthFlow}
                      onChangeStat={changeBirthStat}
                      onConfirmStats={confirmBirthStats}
                    />
                  ) : (
                    <>

                  <div className={`grid gap-3 ${sideQuestUnlocked ? "xl:grid-cols-2" : ""}`}>
                    <div className="rounded-md border border-[#35584a] bg-[#0a1a15] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-sm text-[#e8d79e]">
                          <ScrollText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{life.mainQuest.title}</span>
                        </p>
                        <span className="rounded-full bg-[#234d3d] px-2.5 py-1 text-[11px] text-[#bde2d0]">
                          {life.battle && life.battle.outcome !== "defeat" ? "已完成" : "主线引导"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#aebbb4]">{life.mainQuest.summary}</p>
                      <p className="mt-1 text-[11px] text-[#dc9b7e]">期限：{life.mainQuest.condition}</p>
                    </div>

                    {sideQuestUnlocked && (
                      <div className="rounded-md border border-[#394b42] bg-[#091511] p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-[#82968c]">支线 · {life.sideQuestTriggered ? "已触发" : "可触发"}</p>
                            <p className="mt-0.5 truncate text-sm text-[#e2e7df]">{life.sideQuest.title}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={life.sideQuestTriggered}
                            onClick={beginSideQuest}
                            className="h-8 shrink-0 border-[#466155] bg-transparent px-3 text-xs text-[#bdc8c1] hover:bg-[#17352c] hover:text-white"
                          >
                            {life.sideQuestTriggered ? "已收下" : "触发线索"}
                          </Button>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#aeb9b2]">{life.sideQuest.summary}</p>
                        <p className="mt-1 text-[11px] text-[#71847a]">
                          {life.sideQuest.condition} · 耗时 {prologueConfig.timeSystem.costs.sideQuestDays} 天
                        </p>
                      </div>
                    )}
                  </div>

                  {!life.training ? (
                    <div>
                      <p className="text-sm tracking-[0.16em] text-[#7ea28f]">{prologueConfig.training.eyebrow}</p>
                      <h2 className="mt-2 text-xl text-[#f0dfae]">{prologueConfig.training.title}</h2>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {prologueConfig.training.choices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => selectTraining(choice.id)}
                            className="choice-card rounded-md border border-[#314b40] bg-[#091511] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8c7950] hover:bg-[#10211b] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                          >
                            <span className="text-[#ead9a5]">{choice.title}</span>
                            <span className="mt-2 block text-sm leading-6 text-[#8fa097]">{choice.description}</span>
                            <span className="mt-3 block text-xs text-[#c49975]">{choice.risk}</span>
                            <span className="mt-1 block text-xs text-[#71847a]">耗时 {prologueConfig.timeSystem.costs.trainingDays} 天</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-[#2f493e] bg-[#08130f] p-5">
                      <p className="text-sm text-[#7f9589]">童年修行已定：{life.training.title}</p>
                      <h2 className="mt-2 text-xl text-[#efdfb0]">{prologueConfig.trial.title}</h2>
                      <p className="mt-2 leading-7 text-[#aebbb4]">
                        {prologueConfig.trial.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {(!life.battle || life.battle.outcome === "defeat") && (
                          <Button onClick={startTrial} className="bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
                            <Swords className="h-4 w-4" />
                            {life.battle?.outcome === "defeat" ? prologueConfig.trial.retryButton : prologueConfig.trial.startButton}
                          </Button>
                        )}
                        <span className="text-xs text-[#bc8d78]">{prologueConfig.trial.riskText}</span>
                        <span className="text-xs text-[#71847a]">耗时 {prologueConfig.timeSystem.costs.trialDays} 天</span>
                      </div>
                      {life.battle && life.battle.outcome !== "defeat" && (
                        <div className="mt-4 border-t border-[#29443a] pt-4 text-sm text-[#9fc6b3]">
                          <p>{prologueConfig.trial.completionText}</p>
                          <Button onClick={continueAfterTrial} className="mt-3 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
                            进入青石村
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}
            </section>

            <aside className="flex min-h-0 flex-col gap-3 lg:h-full lg:overflow-hidden">
              <SidebarNavigation
                value={sidebarView}
                life={life}
                statAllocationReady={statAllocationReady}
                inventoryItemCount={inventoryItemCount}
                playerCount={room.players.length}
                onChange={setSidebarView}
              />

              <CharacterPanel
                visible={sidebarView === "character"}
                life={life}
                statAllocationReady={statAllocationReady}
                config={prologueConfig}
              />

              <InventoryPanel
                visible={sidebarView === "assets" && Boolean(life && statAllocationReady && !life.deathState)}
                life={life}
                config={prologueConfig}
                activeActionTarget={activeActionTarget}
                itemActionSelection={itemActionSelection}
                renderActionMenu={renderFreeActionMenu}
                onToggleActionTarget={(key) => {
                  setActiveActionTarget((current) => current === key ? null : key);
                  setFreeActionNotice(null);
                }}
                onEatItem={(selection) => {
                  setActiveActionTarget(selection.key);
                  performFreeAction(selection, "eat_item");
                }}
                onPrepareEventItem={prepareEventItem}
                onPrepareTrialItem={prepareTrialItem}
              />

              {life && statAllocationReady && !life.deathState && (
                <JudgementPanel
                  life={life}
                  config={prologueConfig}
                  pendingChoiceText={pendingEventChoiceText}
                  eventDiceRolling={eventDiceRolling}
                  eventResolutionReady={eventResolutionReady}
                  trialAwaitingRoll={trialAwaitingRoll}
                  trialDiceRolling={trialDiceRolling}
                  onRollEvent={() => void rollEventChoice()}
                  onCancelEvent={() => setPendingEventChoice(null)}
                  onRollTrial={(forcedRoll) => void rollTrial(forcedRoll)}
                />
              )}

              <CompanionsPanel
                visible={sidebarView === "companions"}
                room={room}
                session={session}
                content={content}
                life={life}
                ownPlayer={ownPlayer}
                statAllocationReady={statAllocationReady}
                lifeExpired={lifeExpired}
                activeActionTarget={activeActionTarget}
                error={error}
                lifeActionBusy={lifeActionBusy}
                reincarnationConfig={reincarnationConfig}
                prologueConfig={prologueConfig}
                playerActionSelection={playerActionSelection}
                renderActionMenu={renderFreeActionMenu}
                onToggleActionTarget={(key) => {
                  setActiveActionTarget((current) => current === key ? null : key);
                  setFreeActionNotice(null);
                }}
                canPayRevival={canPayRevival}
                onRevivePlayer={(playerId, method) => void revivePlayer(playerId, method)}
                onCopyInvite={copyInvite}
              />
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <LandingScreen
      content={content}
      name={name}
      roomCode={roomCode}
      pvpEnabled={pvpEnabled}
      busy={busy}
      error={error}
      onNameChange={setName}
      onRoomCodeChange={setRoomCode}
      onPvpChange={setPvpEnabled}
      onCreate={handleCreate}
      onJoin={handleJoin}
    />
  );
}
