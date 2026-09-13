"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, Copy, Dices, Ghost, Globe2, Heart, LogOut, ScrollText, Shield, Sparkles, Swords, Trash2, Users, Zap } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventScene } from "@/components/event-scene";
import { BirthFlow } from "@/components/birth-flow";
import { LongevityPanel } from "@/components/longevity-panel";
import { CycleSecretScene, InheritanceScene, SoulScene } from "@/components/reincarnation-scenes";
import {
  continueVillageAdventure,
  isEventEngineConfig,
  isEventLibraryConfig,
  resolveEventChoice,
  startVillageAdventure,
  toggleEventItem,
  type EventEngineConfig,
  type EventLibraryConfig,
} from "@/lib/events";
import {
  canTriggerSideQuest,
  adjustBirthStat,
  advanceBirthStep,
  chooseTraining,
  currentBirthStep,
  finalizeBirthStats,
  type FiveStats,
  isPrologueConfig,
  itemWorksInContext,
  type PrologueConfig,
  type PrologueLife,
  resolveWoodenTrial,
  rollBirth,
  toggleTrialItem,
  triggerSideQuest,
} from "@/lib/prologue";
import {
  isLifeExpired,
  normalizeLifeTimeline,
  renewLifeAfterRevival,
  spendLifeTime,
  tickLifeTime,
} from "@/lib/longevity";
import {
  applyPendingSpiritLoss,
  completeCycleSecret,
  enterSoulState,
  isReincarnationConfig,
  isSoulExpired,
  recordSoulAction,
  resolveCycleSecret,
  reviveLife,
  shouldShowCycleSecret,
  type LifeInheritance,
  type ReincarnationConfig,
  type RevivalMethodConfig,
  type SoulActionConfig,
} from "@/lib/reincarnation";
import defaultContent from "@/public/游戏内容/界面文字.json";
import defaultPrologueConfig from "@/public/游戏内容/序章规则.json";
import defaultEventConfig from "@/public/游戏内容/随机事件/01-新手村.json";
import defaultEventEngineConfig from "@/public/游戏内容/随机事件/阶段列表.json";
import defaultReincarnationConfig from "@/public/游戏内容/轮回规则.json";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
  lifeStatus: "alive" | "soul" | "rebirth";
  deathDay: number | null;
  reviveDeadlineDay: number | null;
  soulPower: number;
  lastSoulActionDay: number | null;
  pendingSpiritLoss: number;
  realm: string | null;
  level: number;
  currentSpirit: number;
  maxSpirit: number;
};

type Room = {
  code: string;
  pvpEnabled: boolean;
  createdAt: string;
  worldDay: number;
  cycle: number;
  players: Player[];
};

type Session = {
  code: string;
  playerId: string;
  name: string;
};

type PastLifeArchiveEntry = {
  id: string;
  archivedAt: string;
  playerName: string;
  roomCode: string;
  life: PrologueLife;
};

type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): Promise<unknown>;
};

type ModelContext = {
  registerTool(tool: ToolRegistration, options?: { signal?: AbortSignal }): void | Promise<void>;
};

const SESSION_KEY = "lunhui-xiuxian-session";
const LIFE_KEY = "lunhui-xiuxian-prologue-v1";
const PAST_LIVES_KEY = "lunhui-xiuxian-past-lives-v1";

const STAT_LABELS: Array<{ key: keyof FiveStats; label: string }> = [
  { key: "attack", label: "攻击" },
  { key: "defense", label: "防御" },
  { key: "speed", label: "速度" },
  { key: "intelligence", label: "智力" },
  { key: "proficiency", label: "熟练" },
];

type UiContent = typeof defaultContent;

function mergeContent(value: unknown): UiContent {
  if (!value || typeof value !== "object") return defaultContent;
  const candidate = value as Partial<UiContent>;
  return {
    ...defaultContent,
    ...candidate,
    meta: { ...defaultContent.meta, ...candidate.meta },
    brand: { ...defaultContent.brand, ...candidate.brand },
    landing: {
      ...defaultContent.landing,
      ...candidate.landing,
      highlights: Array.isArray(candidate.landing?.highlights)
        ? candidate.landing.highlights
        : defaultContent.landing.highlights,
    },
    world: {
      ...defaultContent.world,
      ...candidate.world,
      storyParagraphs: Array.isArray(candidate.world?.storyParagraphs)
        ? candidate.world.storyParagraphs
        : defaultContent.world.storyParagraphs,
    },
  };
}

async function readJson(response: Response) {
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "请求失败。");
  return data;
}

export default function Home() {
  const [content, setContent] = useState<UiContent>(defaultContent);
  const [prologueConfig, setPrologueConfig] = useState<PrologueConfig>(defaultPrologueConfig as PrologueConfig);
  const [eventConfig, setEventConfig] = useState<EventLibraryConfig>(defaultEventConfig as unknown as EventLibraryConfig);
  const [eventEngineConfig, setEventEngineConfig] = useState<EventEngineConfig>(defaultEventEngineConfig as unknown as EventEngineConfig);
  const [reincarnationConfig, setReincarnationConfig] = useState<ReincarnationConfig>(defaultReincarnationConfig as ReincarnationConfig);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pvpEnabled, setPvpEnabled] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [life, setLife] = useState<PrologueLife | null>(null);
  const [pastLives, setPastLives] = useState<PastLifeArchiveEntry[]>([]);
  const [itemNotice, setItemNotice] = useState("");
  const [lifeActionBusy, setLifeActionBusy] = useState(false);
  const sideQuestUnlocked = life ? canTriggerSideQuest(life) : false;
  const activeBirthStep = life ? currentBirthStep(life) : null;
  const statAllocationReady = activeBirthStep === null || activeBirthStep === "ready";
  const lifeExpired = isLifeExpired(life);

  useEffect(() => {
    void fetch(`/游戏内容/界面文字.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("内容配置读取失败");
        return response.json();
      })
      .then((value: unknown) => {
        const nextContent = mergeContent(value);
        setContent(nextContent);
        document.title = nextContent.meta.title;
        const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (description) description.content = nextContent.meta.description;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch(`/游戏内容/轮回规则.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("轮回规则读取失败");
        return response.json();
      })
      .then((value: unknown) => {
        if (isReincarnationConfig(value)) setReincarnationConfig(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch(`/游戏内容/序章规则.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("序章规则读取失败");
        return response.json();
      })
      .then((value: unknown) => {
        if (isPrologueConfig(value)) setPrologueConfig(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void Promise.all([
      fetch(`/游戏内容/随机事件/01-新手村.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("新手村事件读取失败");
        return response.json();
      }),
      fetch(`/游戏内容/随机事件/阶段列表.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("事件引擎规则读取失败");
        return response.json();
      }),
    ]).then(([library, engine]: unknown[]) => {
      if (isEventLibraryConfig(library)) setEventConfig(library);
      if (isEventEngineConfig(engine)) setEventEngineConfig(engine);
    }).catch(() => undefined);
  }, []);

  const enterSession = useCallback((next: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
    setName(next.name);
    setRoomCode(next.code);
    window.history.replaceState(null, "", `?room=${next.code}`);
  }, []);

  const refreshRoom = useCallback(async (code?: string) => {
    const target = code ?? session?.code;
    if (!target) return null;
    const response = await fetch(`/api/rooms/${target}`, { cache: "no-store" });
    const data = await readJson(response) as unknown as { room: Room };
    setRoom(data.room);
    return data.room;
  }, [session?.code]);

  const createRoom = useCallback(async (creatorName: string, pvp: boolean) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: creatorName, pvpEnabled: pvp }),
      });
      const data = await readJson(response) as { code: string; playerId: string };
      const next = { code: data.code, playerId: data.playerId, name: creatorName.trim() };
      enterSession(next);
      await refreshRoom(data.code);
      return { code: data.code, pvpEnabled: pvp };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "开辟世界失败。";
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [enterSession, refreshRoom]);

  const joinRoom = useCallback(async (joinName: string, codeInput: string) => {
    const code = codeInput.trim().toUpperCase();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${code}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await readJson(response) as { code: string; playerId: string };
      const next = { code: data.code, playerId: data.playerId, name: joinName.trim() };
      enterSession(next);
      await refreshRoom(data.code);
      return { code: data.code, joined: true };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "进入世界失败。";
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [enterSession, refreshRoom]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const queryCode = new URLSearchParams(window.location.search).get("room");
      if (queryCode) setRoomCode(queryCode.toUpperCase().slice(0, 6));
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return;
      try {
        const restored = JSON.parse(saved) as Session;
        if (restored.code && restored.playerId && restored.name) {
          setSession(restored);
          setName(restored.name);
          setRoomCode(restored.code);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!session) return;
    const initialTimer = window.setTimeout(() => {
      void refreshRoom().catch((caught) => {
        setError(caught instanceof Error ? caught.message : "世界暂时失去回应。");
      });
    }, 0);
    const timer = window.setInterval(() => {
      void refreshRoom().catch(() => undefined);
    }, 4000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refreshRoom, session]);

  useEffect(() => {
    let restored: PrologueLife | null = null;
    let restoredPastLives: PastLifeArchiveEntry[] = [];
    if (!session) {
      const timer = window.setTimeout(() => {
        setLife(null);
        setPastLives([]);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const saved = localStorage.getItem(`${LIFE_KEY}:${session.playerId}`);
    if (saved) {
      try {
        const candidate = JSON.parse(saved) as PrologueLife;
        restored = candidate.version === 1
          ? normalizeLifeTimeline(candidate, prologueConfig.timeSystem)
          : null;
      } catch {
        localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
      }
    }
    const archived = localStorage.getItem(`${PAST_LIVES_KEY}:${session.playerId}`);
    if (archived) {
      try {
        const candidate = JSON.parse(archived) as unknown;
        restoredPastLives = Array.isArray(candidate)
          ? candidate.filter((entry): entry is PastLifeArchiveEntry => Boolean(
              entry
                && typeof entry === "object"
                && "id" in entry
                && "archivedAt" in entry
                && "life" in entry,
            ))
          : [];
      } catch {
        localStorage.removeItem(`${PAST_LIVES_KEY}:${session.playerId}`);
      }
    }
    const timer = window.setTimeout(() => {
      setLife(restored);
      setPastLives(restoredPastLives);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [prologueConfig.timeSystem, session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      setLife((current) => {
        if (!current || current.deathState) return current;
        const next = tickLifeTime(current, prologueConfig.timeSystem);
        if (next === current) return current;
        localStorage.setItem(`${LIFE_KEY}:${session.playerId}`, JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [prologueConfig.timeSystem, session]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const report = () => undefined;

    void Promise.resolve(modelContext.registerTool({
      name: "create_xiuxian_room",
      title: "开辟修仙世界",
      description: "以指定道号创建一个最多四人的修仙测试房间。",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 2, maxLength: 16 },
          pvpEnabled: { type: "boolean" },
        },
        required: ["name", "pvpEnabled"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { name?: unknown; pvpEnabled?: unknown };
        if (typeof value.name !== "string" || typeof value.pvpEnabled !== "boolean") {
          throw new Error("需要提供道号和PVP设置。");
        }
        return createRoom(value.name, value.pvpEnabled);
      },
    }, { signal: lifecycle.signal })).catch(report);

    void Promise.resolve(modelContext.registerTool({
      name: "join_xiuxian_room",
      title: "加入修仙世界",
      description: "使用六位房间码和道号加入一个修仙测试房间。",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 2, maxLength: 16 },
          roomCode: { type: "string", minLength: 6, maxLength: 6 },
        },
        required: ["name", "roomCode"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { name?: unknown; roomCode?: unknown };
        if (typeof value.name !== "string" || typeof value.roomCode !== "string") {
          throw new Error("需要提供道号和房间码。");
        }
        return joinRoom(value.name, value.roomCode);
      },
    }, { signal: lifecycle.signal })).catch(report);

    return () => lifecycle.abort();
  }, [createRoom, joinRoom]);

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

  async function copyInvite() {
    if (!session) return;
    const invite = `${window.location.origin}/?room=${session.code}`;
    await navigator.clipboard.writeText(invite);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const persistLife = useCallback((next: PrologueLife) => {
    if (!session) return;
    const normalized = normalizeLifeTimeline(next, prologueConfig.timeSystem);
    localStorage.setItem(`${LIFE_KEY}:${session.playerId}`, JSON.stringify(normalized));
    setLife(normalized);
  }, [prologueConfig.timeSystem, session]);

  const performRoomAction = useCallback(async (body: Record<string, unknown>) => {
    if (!session) throw new Error("尚未进入世界。");
    const response = await fetch(`/api/rooms/${session.code}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, playerId: session.playerId }),
    });
    const data = await readJson(response) as unknown as { room: Room; soulPower?: number; drained?: number };
    if (data.room) setRoom(data.room);
    return data;
  }, [session]);

  const archiveCurrentLife = useCallback((current: PrologueLife) => {
    if (!session) return false;
    const entry: PastLifeArchiveEntry = {
      id: `${session.playerId}-cycle-${current.cycle ?? 1}`,
      archivedAt: new Date().toISOString(),
      playerName: session.name,
      roomCode: session.code,
      life: current,
    };
    try {
      const stored = localStorage.getItem(`${PAST_LIVES_KEY}:${session.playerId}`);
      const previous = stored ? JSON.parse(stored) as PastLifeArchiveEntry[] : [];
      if (previous.some((candidate) => candidate.id === entry.id)) {
        localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
        setPastLives(previous);
        setLife(null);
        return true;
      }
      const next = [...previous, entry];
      localStorage.setItem(`${PAST_LIVES_KEY}:${session.playerId}`, JSON.stringify(next));
      localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
      setPastLives(next);
      setLife(null);
      return true;
    } catch {
      setItemNotice("本机存储空间不足，这一世尚未保存。");
      return false;
    }
  }, [session]);

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
  }, [archiveCurrentLife, life, performRoomAction, persistLife, prologueConfig.timeSystem, reincarnationConfig, room, session]);

  useEffect(() => {
    if (!life?.battle || life.battle.outcome === "defeat" || life.adventure || life.deathState || isLifeExpired(life)) return;
    const timer = window.setTimeout(() => {
      persistLife(startVillageAdventure(life, eventConfig, eventEngineConfig));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [eventConfig, eventEngineConfig, life, persistLife]);

  function beginLife(inheritance?: LifeInheritance) {
    const cycle = room?.cycle ?? 1;
    persistLife(rollBirth(prologueConfig, inheritance, cycle));
    void performRoomAction({ action: "begin_life" }).catch(() => undefined);
  }

  function beginSideQuest() {
    if (!life || !statAllocationReady || life.deathState || lifeExpired) return;
    persistLife(spendLifeTime(
      triggerSideQuest(life),
      prologueConfig.timeSystem.costs.sideQuestDays,
      "追查支线",
      prologueConfig.timeSystem,
    ));
  }

  function selectTraining(choiceId: string) {
    if (!life || !statAllocationReady || life.deathState || lifeExpired) return;
    persistLife(spendLifeTime(
      chooseTraining(life, choiceId, prologueConfig.training.choices),
      prologueConfig.timeSystem.costs.trainingDays,
      "童年修炼",
      prologueConfig.timeSystem,
    ));
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
    persistLife(spendLifeTime(
      advanceBirthStep(life),
      prologueConfig.timeSystem.costs.birthStepDays,
      "入世定命",
      prologueConfig.timeSystem,
    ));
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
    const resolved = resolveWoodenTrial(life, prologueConfig.trial);
    const next = resolved.battle?.outcome === "defeat"
      ? resolved
      : startVillageAdventure(resolved, eventConfig, eventEngineConfig);
    persistLife(spendLifeTime(
      next,
      prologueConfig.timeSystem.costs.trialDays,
      "木傀试炼",
      prologueConfig.timeSystem,
    ));
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
    setItemNotice("");
    persistLife(spendLifeTime(
      resolveEventChoice(life, eventConfig, choiceId, eventEngineConfig),
      prologueConfig.timeSystem.costs.randomEventDays,
      "经历随机事件",
      prologueConfig.timeSystem,
    ));
  }

  function continueEvent() {
    if (!life?.adventure) return;
    setItemNotice("");
    persistLife(continueVillageAdventure(life, eventConfig, eventEngineConfig));
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

  function resetAllLives() {
    if (!session) return;
    localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
    localStorage.removeItem(`${PAST_LIVES_KEY}:${session.playerId}`);
    setPastLives([]);
    setItemNotice("");
    setLife(null);
  }

  async function leaveRoom() {
    if (session) {
      await fetch(`/api/rooms/${session.code}?playerId=${encodeURIComponent(session.playerId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setError("");
    window.history.replaceState(null, "", window.location.pathname);
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
    return (
      <main className="world-grid min-h-screen px-4 py-5 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#29443a] pb-4">
            <div className="flex items-center gap-3">
              <div className="seal grid h-10 w-10 place-items-center text-lg font-bold">{content.brand.seal}</div>
              <div>
                <p className="text-lg tracking-[0.22em] text-[#f0dfae]">{content.brand.name}</p>
                <p className="text-sm text-[#82968c]">{content.brand.subtitle}</p>
              </div>
            </div>
            <Button variant="outline" onClick={leaveRoom} className="border-[#385248] bg-transparent text-[#bbc8c0] hover:bg-[#14241f] hover:text-white">
              <LogOut className="h-4 w-4" />
              {content.world.leaveButton}
            </Button>
          </header>

          <section className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="ink-panel rounded-lg border border-[#29443a] p-5">
              <p className="text-sm text-[#82968c]">{content.world.roomLabel}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <strong className="font-mono text-2xl tracking-[0.22em] text-[#f0dfae]">{room.code}</strong>
                <Button size="sm" variant="ghost" onClick={copyInvite} className="text-[#9fb2a8] hover:bg-[#17352c] hover:text-white">
                  <Copy className="h-4 w-4" />
                  {copied ? content.world.copiedShort : content.world.inviteShort}
                </Button>
              </div>
            </div>
            <div className="ink-panel rounded-lg border border-[#29443a] p-5">
              <p className="text-sm text-[#82968c]">{content.world.calendarLabel}</p>
              <p className="mt-2 text-2xl text-[#eef1e7]">{content.world.dayPrefix}{room.worldDay}{content.world.daySuffix}</p>
            </div>
            <div className="ink-panel rounded-lg border border-[#29443a] p-5">
              <p className="text-sm text-[#82968c]">{content.world.pvpLabel}</p>
              <p className="mt-2 flex items-center gap-2 text-2xl text-[#eef1e7]">
                {room.pvpEnabled ? <Swords className="h-5 w-5 text-[#d17a68]" /> : <Shield className="h-5 w-5 text-[#73b59a]" />}
                {content.world.pvpPrefix}{room.pvpEnabled ? content.world.pvpEnabled : content.world.pvpDisabled}
              </p>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.82fr]">
            <section className="ink-panel min-h-[540px] rounded-lg border border-[#29443a] p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm tracking-[0.2em] text-[#7ea28f]">{content.world.location}</p>
                  <h1 className="mt-2 text-2xl text-[#f4e8c5] sm:text-3xl">
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
                          <Button title={reincarnationConfig.death.testDeathHint} variant="outline" size="sm" className="border-[#66516f] bg-transparent text-[#b8a4c1] hover:bg-[#211629] hover:text-white">
                            <Ghost className="h-4 w-4" />
                            {reincarnationConfig.death.testDeathButton}
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
                        <Button variant="ghost" size="sm" className="text-[#b17e75] hover:bg-[#321d19] hover:text-[#f1b2a5]">
                          <Trash2 className="h-4 w-4" />
                          {content.world.resetAllButton}
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
              <div className="gold-rule my-6 h-px" />
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
                <div className="space-y-6">
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
                  <Button onClick={() => beginLife()} className="h-12 bg-[#d6b66d] px-7 text-[#102019] hover:bg-[#e7cc8b]">
                    <Dices className="h-4 w-4" />
                    {prologueConfig.intro.rollButton}
                  </Button>
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
                  onChoose={chooseEvent}
                  onContinue={continueEvent}
                />
              ) : (
                <div className="space-y-6">
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

                  <div className="rounded-md border border-[#35584a] bg-[#0a1a15] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[#e8d79e]">
                        <ScrollText className="h-4 w-4" />
                        {life.mainQuest.title}
                      </p>
                      <span className="rounded-full bg-[#234d3d] px-3 py-1 text-xs text-[#bde2d0]">
                        {life.battle && life.battle.outcome !== "defeat" ? "已完成" : "立即引导"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#aebbb4]">{life.mainQuest.summary}</p>
                    <p className="mt-2 text-xs text-[#dc9b7e]">境界期限：{life.mainQuest.condition}</p>
                  </div>

                  {sideQuestUnlocked && (
                    <div className="rounded-md border border-[#394b42] bg-[#091511] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-[#82968c]">支线 · {life.sideQuestTriggered ? "已触发" : sideQuestUnlocked ? "可触发" : "条件未满足"}</p>
                        <p className="mt-1 text-[#e2e7df]">{life.sideQuest.title}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={life.sideQuestTriggered}
                        onClick={beginSideQuest}
                        className="border-[#466155] bg-transparent text-[#bdc8c1] hover:bg-[#17352c] hover:text-white"
                      >
                        {life.sideQuestTriggered ? "线索已收下" : "触发线索"}
                      </Button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#899b92]">解锁条件：{life.sideQuest.condition}</p>
                    <p className="mt-1 text-sm leading-6 text-[#aeb9b2]">{life.sideQuest.summary}</p>
                    <p className="mt-2 text-xs text-[#71847a]">追查耗时 {prologueConfig.timeSystem.costs.sideQuestDays} 天</p>
                    </div>
                  )}

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
                          {prologueConfig.trial.completionText}
                        </div>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <section className="ink-panel rounded-lg border border-[#29443a] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg text-[#f0dfae]">{life && !statAllocationReady ? "入世进度" : "此世命格"}</h2>
                  <span className="text-sm text-[#82968c]">{life && statAllocationReady ? `${life.realm} · ${life.level}级` : "尚未定命"}</span>
                </div>
                {life && statAllocationReady ? (
                  <>
                    <div className="mt-4 rounded border border-[#4a5036] bg-[#11170f] px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-[#82968c]">{prologueConfig.character.rootSummaryLabel}</span>
                        <strong className="text-sm font-normal text-[#e7d49c]">{life.root.name}</strong>
                      </div>
                      <p className="mt-1.5 text-xs text-[#8da096]" title={life.root.talentText}>
                        {prologueConfig.character.talentSummaryLabel}「{life.root.talent}」
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {STAT_LABELS.map(({ key, label }) => (
                        <div key={key} className="rounded border border-[#29443a] bg-[#091511] px-2 py-3 text-center">
                          <p className="text-xs text-[#71847a]">{label}</p>
                          <p className="mt-1 font-mono text-lg text-[#e7d49c]">{life.stats[key]}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-[#b6c4bc]"><Heart className="h-4 w-4 text-[#d8796a]" />气血</span>
                          <span className="font-mono text-[#d8dfda]">{life.currentHealth} / {life.maxHealth}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1b2823]">
                          <div className="h-full rounded-full bg-[#b95f55]" style={{ width: `${Math.round((life.currentHealth / life.maxHealth) * 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-[#b6c4bc]"><Zap className="h-4 w-4 text-[#6e9fc0]" />灵力</span>
                          <span className="font-mono text-[#d8dfda]">{life.currentSpirit} / {life.maxSpirit}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1b2823]">
                          <div className="h-full rounded-full bg-[#5f91b5]" style={{ width: `${Math.round((life.currentSpirit / life.maxSpirit) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    {life.statAllocationFinalized && (
                      <p className="mt-3 text-xs leading-5 text-[#75887e]">
                        {prologueConfig.character.allocationCompleteText}
                      </p>
                    )}
                    {(life.deathMarks?.length ?? 0) > 0 && (
                      <div className="mt-3 rounded border border-[#54405f] bg-[#160f1c] px-3 py-2">
                        <p className="text-xs text-[#9b86a7]">死亡命格</p>
                        {life.deathMarks?.map((mark) => (
                          <p key={mark.id} className="mt-1 text-sm text-[#d6c0df]" title={mark.description}>「{mark.name}」</p>
                        ))}
                      </div>
                    )}
                    {life.inheritedMemory && (
                      <div className="mt-3 rounded border border-[#4a5036] bg-[#11170f] px-3 py-2">
                        <p className="text-xs text-[#82968c]">前世记忆</p>
                        <p className="mt-1 text-sm text-[#e0ce91]" title={life.inheritedMemory.description}>「{life.inheritedMemory.name}」</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[#71847a]">
                    {life ? prologueConfig.character.earlySidebarText : "掷定此生命数后，从出身开始一步步完成入世。"}
                  </p>
                )}
              </section>

              {life && <LongevityPanel life={life} rules={prologueConfig.timeSystem} />}

              {life && statAllocationReady && !life.deathState && (
                <section className="ink-panel rounded-lg border border-[#29443a] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg text-[#f0dfae]">{prologueConfig.character.assetsTitle}</h2>
                  <span className="rounded-full border border-[#5f5335] px-3 py-1 font-mono text-sm text-[#e3c873]">
                    {prologueConfig.character.spiritStoneLabel} {life?.spiritStones ?? 0}
                  </span>
                </div>
                {life ? (
                  <Tabs defaultValue="inventory" className="mt-4">
                    <TabsList className="grid w-full grid-cols-3 bg-[#08130f]">
                      <TabsTrigger value="inventory">{prologueConfig.character.inventoryTab}</TabsTrigger>
                      <TabsTrigger value="cultivation">{prologueConfig.character.cultivationTab}</TabsTrigger>
                      <TabsTrigger value="technique">{prologueConfig.character.techniqueTab}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="inventory" className="mt-4">
                      {(life.inventory ?? []).some((item) => item.quantity > 0) ? (
                        <div className="space-y-3">
                          {(life.inventory ?? []).filter((item) => item.quantity > 0).map((item) => {
                            const eventPreparing = Boolean(
                              life.adventure?.currentEventId
                                && !life.adventure.lastResolution
                                && !life.adventure.stageComplete,
                            );
                            const selected = eventPreparing
                              ? life.adventure?.selectedItemIds.includes(item.id) ?? false
                              : life.selectedTrialItemIds?.includes(item.id) ?? false;
                            const mayPrepare = eventPreparing
                              || Boolean(!life.adventure && life.training && (!life.battle || life.battle.outcome === "defeat"));
                            return (
                              <div key={item.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm text-[#e6d8ad]">{item.name} × {item.quantity}</p>
                                    <p className="mt-1 text-xs text-[#75887e]">{item.category} · {item.consumable ? "消耗品" : "持有物"}</p>
                                  </div>
                                  {mayPrepare && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => eventPreparing ? prepareEventItem(item.id) : prepareTrialItem(item.id)}
                                      className={selected
                                        ? "border-[#b99a56] bg-[#3b321c] text-[#f0d78f] hover:bg-[#4a3e22]"
                                        : "border-[#3b584a] bg-transparent text-[#aebdb5] hover:bg-[#17352c] hover:text-white"}
                                    >
                                      {selected ? prologueConfig.character.selectedItem : prologueConfig.character.selectItem}
                                    </Button>
                                  )}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[#98a69f]">{item.description}</p>
                              </div>
                            );
                          })}
                          <p className="text-xs leading-5 text-[#70837a]">
                            {life.adventure
                              ? "可为当前事件备好任意数量的道具；结算时仅消耗真正生效的消耗品。"
                              : prologueConfig.character.itemUseHint}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-[#71847a]">{prologueConfig.character.inventoryEmpty}</p>
                      )}
                    </TabsContent>
                    <TabsContent value="cultivation" className="mt-4 space-y-3">
                      {(life.cultivationArts ?? []).length > 0 ? (life.cultivationArts ?? []).map((ability) => (
                        <div key={ability.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-[#e6d8ad]">{ability.name}</p>
                            <span className="text-xs text-[#b69a63]">{ability.grade}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#98a69f]">{ability.description}</p>
                        </div>
                      )) : <p className="text-sm text-[#71847a]">{prologueConfig.character.cultivationEmpty}</p>}
                    </TabsContent>
                    <TabsContent value="technique" className="mt-4 space-y-3">
                      {(life.techniques ?? []).length > 0 ? (life.techniques ?? []).map((ability) => (
                        <div key={ability.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-[#e6d8ad]">{ability.name}</p>
                            <span className="text-xs text-[#b69a63]">{ability.grade}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#98a69f]">{ability.description}</p>
                        </div>
                      )) : <p className="text-sm text-[#71847a]">{prologueConfig.character.techniqueEmpty}</p>}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="mt-4 text-sm text-[#71847a]">{prologueConfig.character.inventoryEmpty}</p>
                )}
                </section>
              )}

              {life && statAllocationReady && !life.deathState && (
                <section className="battle-window ink-panel rounded-lg border border-[#3f554b] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg text-[#f0dfae]">
                    <Swords className="h-5 w-5" />
                    {life?.adventure ? "事件判定" : prologueConfig.trial.windowTitle}
                  </h2>
                  <span className="rounded-full border border-[#3d554a] px-2.5 py-1 text-xs text-[#82968c]">
                    {life?.adventure ? "即时结算" : prologueConfig.trial.windowBadge}
                  </span>
                </div>
                {life?.adventure ? (
                  life.adventure.lastResolution ? (
                    <div className="mt-4">
                      {life.adventure.lastResolution.calculation ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#253b32] bg-[#08120f] px-3 py-2 text-sm">
                            <span className="text-[#93a59b]">{life.adventure.lastResolution.calculation.statLabel}</span>
                            <span className="text-[#d8dfda]">{life.adventure.lastResolution.calculation.statValue}</span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#253b32] bg-[#08120f] px-3 py-2 text-sm">
                            <span className="text-[#93a59b]">功法 / 技法 / 特性</span>
                            <span className="text-[#d8dfda]">
                              +{life.adventure.lastResolution.calculation.cultivationBonus
                                + life.adventure.lastResolution.calculation.techniqueBonus
                                + life.adventure.lastResolution.calculation.modifierBonus}
                            </span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#253b32] bg-[#08120f] px-3 py-2 text-sm">
                            <span className="text-[#93a59b]">道具 / 随机</span>
                            <span className="text-[#d8dfda]">
                              +{life.adventure.lastResolution.calculation.itemBonus} / +{life.adventure.lastResolution.calculation.randomRoll}
                            </span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#3f594c] bg-[#10211b] px-3 py-2 text-sm">
                            <span className="text-[#b6c4bc]">最终比较</span>
                            <span className={life.adventure.lastResolution.calculation.margin >= 0 ? "text-[#8fc9aa]" : "text-[#d58b79]"}>
                              {life.adventure.lastResolution.calculation.total} : {life.adventure.lastResolution.calculation.difficulty}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="rounded border border-[#253b32] bg-[#08120f] px-3 py-3 text-sm text-[#93a59b]">此选项无需判定，直接结算。</p>
                      )}
                      <div className="mt-4 rounded-md border border-[#486a58] bg-[#10241c] p-4">
                        <p className="text-lg text-[#f1dfaa]">{life.adventure.lastResolution.title}</p>
                        <p className="mt-2 text-sm leading-6 text-[#aebbb4]">{life.adventure.lastResolution.resultText}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-md border border-dashed border-[#31483e] px-4 py-6 text-center">
                      <p className="text-sm text-[#71847a]">等待你的选择</p>
                      <p className="mt-2 text-xs leading-5 text-[#566b61]">
                        选择后只在这里展示关键加成与最终比较，不展开冗长战斗日志。
                      </p>
                    </div>
                  )
                ) : life?.battle ? (
                  <div className="mt-4">
                    <div className="space-y-2">
                      {life.battle.comparisons.map((item) => (
                        <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded border border-[#253b32] bg-[#08120f] px-3 py-2 text-sm">
                          <span className="text-[#93a59b]">{item.label}</span>
                          <span className={item.player >= item.enemy ? "text-[#8fc9aa]" : "text-[#d58b79]"}>
                            {item.player} : {item.enemy} · {item.verdict}
                          </span>
                        </div>
                      ))}
                    </div>
                    {(life.battle.itemMessages ?? []).length > 0 && (
                      <div className="mt-3 space-y-1 rounded border border-[#5b4e31] bg-[#1b170e] px-3 py-2">
                        {life.battle.itemMessages?.map((message) => (
                          <p key={message} className="text-xs leading-5 text-[#d9c081]">{message}</p>
                        ))}
                      </div>
                    )}
                    <div className={`mt-4 rounded-md border p-4 ${life.battle.outcome === "defeat" ? "border-[#73443b] bg-[#2a1714]" : "border-[#486a58] bg-[#10241c]"}`}>
                      <p className="text-lg text-[#f1dfaa]">{life.battle.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#aebbb4]">{life.battle.summary}</p>
                      <p className="mt-2 text-sm text-[#d4b875]">{life.battle.reward}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-[#31483e] px-4 py-6 text-center">
                    <p className="text-sm text-[#71847a]">{prologueConfig.trial.emptyTitle}</p>
                    <p className="mt-2 text-xs leading-5 text-[#566b61]">{prologueConfig.trial.emptyText}</p>
                  </div>
                )}
                </section>
              )}

              <section className="ink-panel rounded-lg border border-[#29443a] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base text-[#f0dfae]">
                    <Users className="h-4 w-4" />
                    {content.world.playersTitle}
                  </h2>
                  <span className="text-sm text-[#82968c]">{room.players.length} / 4</span>
                </div>
                <div className="mt-4 space-y-2">
                  {room.players.map((player) => (
                    <div key={player.id} className={`rounded-md border px-3 py-2 ${player.lifeStatus === "soul" ? "border-[#594565] bg-[#150f1b]" : "border-[#284138] bg-[#091511]"}`}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[#e7ebe4]">{player.name}</p>
                          <p className="text-xs text-[#74877e]">
                            {player.lifeStatus === "soul"
                              ? `残魂 · 魂力 ${player.soulPower}`
                              : player.lifeStatus === "rebirth"
                                ? "等待轮回"
                                : `${player.realm ?? (player.isHost ? content.world.hostRole : content.world.playerRole)} · ${player.level}级`}
                          </p>
                        </div>
                        {player.lifeStatus === "soul" && <Ghost className="h-4 w-4 text-[#a987ba]" />}
                        {player.id === session.playerId && <span className="text-xs text-[#d6b66d]">{content.world.currentPlayer}</span>}
                      </div>
                      {player.lifeStatus === "soul" && ownPlayer?.lifeStatus === "alive" && player.id !== session.playerId && life && !life.deathState && (
                        <details className="mt-2 border-t border-[#493852] pt-2">
                          <summary className="cursor-pointer text-xs text-[#c2a8cf]">{reincarnationConfig.revival.title}</summary>
                          <p className="mt-2 text-xs leading-5 text-[#7f7485]">{reincarnationConfig.revival.summary}</p>
                          <div className="mt-2 grid gap-2">
                            {reincarnationConfig.revival.methods.filter((method) => !method.selfOnly).map((method) => {
                              const cost = method.actorCost ?? {};
                              const costText = cost.spiritStones
                                ? `${cost.spiritStones} 灵石`
                                : cost.spirit
                                  ? `${cost.spirit} 灵力`
                                  : cost.itemId
                                    ? `道具 ×${cost.itemQuantity ?? 1}`
                                    : "无消耗";
                              return (
                                <Button
                                  key={method.id}
                                  size="sm"
                                  variant="outline"
                                  disabled={lifeActionBusy || !canPayRevival(method)}
                                  onClick={() => void revivePlayer(player.id, method)}
                                  className="justify-between border-[#594565] bg-transparent text-[#ccb8d5] hover:bg-[#24182b] hover:text-white"
                                  title={method.description}
                                >
                                  <span>{method.title}</span><span className="text-[11px] opacity-70">{costText}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
                <Button onClick={copyInvite} size="sm" className="mt-4 w-full bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
                  <Copy className="h-4 w-4" />
                  {copied ? content.world.copiedInvite : content.world.copyInvite}
                </Button>
                {error && <p className="mt-3 text-sm text-[#e99580]">{error}</p>}
                {life && statAllocationReady && (
                  <>
                    <div className="mt-5 border-t border-[#29443a] pt-4">
                      <p className="text-sm text-[#d9c98f]">{reincarnationConfig.death.title}</p>
                      <p className="mt-2 text-xs leading-5 text-[#7f9288]">{reincarnationConfig.death.summary}</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-[#d9c98f]">{prologueConfig.worldRules.multiplayerTitle}</p>
                      <div className="mt-2 space-y-2">
                        {prologueConfig.worldRules.raids.map((raid) => (
                          <div key={raid.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-[#dce4dc]">{raid.name}</p>
                              <span className="text-xs text-[#b99a60]">{raid.status}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#768a80]">{raid.description}</p>
                            <p className="mt-2 text-xs text-[#60746a]">
                              {raid.minimumPlayers}–{raid.maximumPlayers} 人 · {raid.unlockRealm}解锁
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="world-grid min-h-screen px-4 py-6 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-[#29443a] pb-4">
          <div className="flex items-center gap-3">
            <div className="seal grid h-10 w-10 place-items-center text-lg font-bold">{content.brand.seal}</div>
            <div>
              <p className="text-lg tracking-[0.22em] text-[#f0dfae]">{content.brand.name}</p>
              <p className="text-sm text-[#82968c]">{content.brand.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#8aa296]">
            <span className="slow-pulse h-2 w-2 rounded-full bg-[#71b395]" />
            {content.brand.serviceStatus}
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-105px)] items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <p className="mb-4 flex items-center gap-2 text-sm tracking-[0.24em] text-[#7fa08f]">
              <Globe2 className="h-4 w-4" />
              {content.landing.eyebrow}
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight text-[#f4e8c5] sm:text-6xl">
              {content.landing.titleLead}
              <span className="block text-[#d6b66d]">{content.landing.titleAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#9fb0a7]">
              {content.landing.description}
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {content.landing.highlights.map(({ value, label }) => (
                <div key={value} className="border-l border-[#496355] pl-4">
                  <p className="text-xl text-[#e7d49c]">{value}</p>
                  <p className="mt-1 text-sm text-[#74877e]">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ink-panel rounded-lg border border-[#355046] p-5 sm:p-7">
            <Tabs defaultValue={roomCode ? "join" : "create"}>
              <TabsList className="grid w-full grid-cols-2 bg-[#08130f]">
                <TabsTrigger value="create">{content.landing.createTab}</TabsTrigger>
                <TabsTrigger value="join">{content.landing.joinTab}</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-6">
                <form onSubmit={handleCreate} className="space-y-5">
                  <div>
                    <label htmlFor="create-name" className="mb-2 block text-sm text-[#9caf9f]">{content.landing.nameLabel}</label>
                    <Input
                      id="create-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={content.landing.createNamePlaceholder}
                      minLength={2}
                      maxLength={16}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] text-base"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-[#2d483d] bg-[#091511] p-4">
                    <div>
                      <label htmlFor="pvp-switch" className="text-[#e2e8df]">{content.landing.pvpLabel}</label>
                      <p className="mt-1 text-sm text-[#74877e]">{content.landing.pvpDescription}</p>
                    </div>
                    <Switch id="pvp-switch" checked={pvpEnabled} onCheckedChange={setPvpEnabled} />
                  </div>
                  <Button type="submit" disabled={busy} className="h-12 w-full bg-[#d6b66d] text-base text-[#102019] hover:bg-[#e7cc8b]">
                    <Sparkles className="h-4 w-4" />
                    {busy ? content.landing.createBusy : content.landing.createButton}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                <form onSubmit={handleJoin} className="space-y-5">
                  <div>
                    <label htmlFor="join-name" className="mb-2 block text-sm text-[#9caf9f]">{content.landing.nameLabel}</label>
                    <Input
                      id="join-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={content.landing.joinNamePlaceholder}
                      minLength={2}
                      maxLength={16}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="room-code" className="mb-2 block text-sm text-[#9caf9f]">{content.landing.roomCodeLabel}</label>
                    <Input
                      id="room-code"
                      value={roomCode}
                      onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))}
                      placeholder={content.landing.roomCodePlaceholder}
                      minLength={6}
                      maxLength={6}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] font-mono text-lg tracking-[0.22em]"
                    />
                  </div>
                  <Button type="submit" disabled={busy} className="h-12 w-full bg-[#d6b66d] text-base text-[#102019] hover:bg-[#e7cc8b]">
                    <Users className="h-4 w-4" />
                    {busy ? content.landing.joinBusy : content.landing.joinButton}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && <p role="alert" className="mt-4 rounded-md border border-[#743f36] bg-[#351b18] px-4 py-3 text-sm text-[#f0a08d]">{error}</p>}
            <p className="mt-5 text-center text-sm leading-6 text-[#6f8278]">{content.landing.privacyNotice}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
