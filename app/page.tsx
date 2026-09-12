"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, Dices, Globe2, Heart, LogOut, ScrollText, Shield, Sparkles, Swords, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  canTriggerSideQuest,
  chooseTraining,
  type FiveStats,
  type PrologueLife,
  resolveWoodenTrial,
  rollBirth,
  TRAINING_CHOICES,
  triggerSideQuest,
} from "@/lib/prologue";
import defaultContent from "@/public/游戏内容/界面文字.json";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
};

type Room = {
  code: string;
  pvpEnabled: boolean;
  createdAt: string;
  worldDay: number;
  players: Player[];
};

type Session = {
  code: string;
  playerId: string;
  name: string;
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
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pvpEnabled, setPvpEnabled] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [life, setLife] = useState<PrologueLife | null>(null);
  const sideQuestUnlocked = life ? canTriggerSideQuest(life) : false;

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
    if (!session) {
      const timer = window.setTimeout(() => setLife(null), 0);
      return () => window.clearTimeout(timer);
    }
    const saved = localStorage.getItem(`${LIFE_KEY}:${session.playerId}`);
    if (saved) {
      try {
        const candidate = JSON.parse(saved) as PrologueLife;
        restored = candidate.version === 1 ? candidate : null;
      } catch {
        localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
      }
    }
    const timer = window.setTimeout(() => setLife(restored), 0);
    return () => window.clearTimeout(timer);
  }, [session]);

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
    localStorage.setItem(`${LIFE_KEY}:${session.playerId}`, JSON.stringify(next));
    setLife(next);
  }, [session]);

  function beginLife() {
    persistLife(rollBirth());
  }

  function beginSideQuest() {
    if (!life) return;
    persistLife(triggerSideQuest(life));
  }

  function selectTraining(choiceId: "herbs" | "stones" | "kite") {
    if (!life) return;
    persistLife(chooseTraining(life, choiceId));
  }

  function startTrial() {
    if (!life?.training) return;
    persistLife(resolveWoodenTrial(life));
  }

  function restartLife() {
    if (!session) return;
    localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
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

  if (session && room) {
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm tracking-[0.2em] text-[#7ea28f]">{content.world.location}</p>
                  <h1 className="mt-2 text-2xl text-[#f4e8c5] sm:text-3xl">
                    {life ? "这一世，从出生开始" : "命数未定，静候降生"}
                  </h1>
                </div>
                {life ? (
                  <Button variant="ghost" size="sm" onClick={restartLife} className="text-[#758a80] hover:bg-[#17352c] hover:text-white">
                    重开本世
                  </Button>
                ) : (
                  <Sparkles className="slow-pulse h-6 w-6 text-[#d6b66d]" />
                )}
              </div>
              <div className="gold-rule my-6 h-px" />

              {!life ? (
                <div className="space-y-6">
                  <p className="max-w-2xl text-base leading-8 text-[#b8c5bd]">
                    世界先替你决定出身、五维与灵根。灵根数量会改变前期处境、天赋和可触发支线，但不会锁死最终潜力。
                  </p>
                  <div className="rounded-md border border-[#2d483d] bg-[#08120f]/80 p-5">
                    <p className="text-sm text-[#789087]">本次试玩流程</p>
                    <p className="mt-2 leading-7 text-[#d9dfd7]">出生 Roll 点 → 童年选择 → 支线线索 → 木傀自动战斗 → 直接结算</p>
                  </div>
                  <Button onClick={beginLife} className="h-12 bg-[#d6b66d] px-7 text-[#102019] hover:bg-[#e7cc8b]">
                    <Dices className="h-4 w-4" />
                    掷定此生命数
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="leading-8 text-[#b8c5bd]">{life.birthText}</p>
                    <div className="mt-4 rounded-md border border-[#5a4c2d] bg-[#17170f]/90 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm tracking-[0.18em] text-[#a8996e]">测灵结果</p>
                          <h2 className="mt-1 text-xl text-[#efd48d]">{life.root.name}</h2>
                        </div>
                        <span className="rounded-full border border-[#65583b] px-3 py-1 text-xs text-[#cabb91]">{life.root.growth}</span>
                      </div>
                      <p className="mt-4 leading-7 text-[#c5c7b9]">{life.root.reception}</p>
                      <p className="mt-3 text-sm text-[#91a39a]">天赋「{life.root.talent}」：{life.root.talentText}</p>
                    </div>
                  </div>

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

                  <div className="rounded-md border border-[#394b42] bg-[#091511] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-[#82968c]">支线 · {life.sideQuestTriggered ? "已触发" : sideQuestUnlocked ? "可触发" : "条件未满足"}</p>
                        <p className="mt-1 text-[#e2e7df]">{life.sideQuest.title}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={life.sideQuestTriggered || !sideQuestUnlocked}
                        onClick={beginSideQuest}
                        className="border-[#466155] bg-transparent text-[#bdc8c1] hover:bg-[#17352c] hover:text-white"
                      >
                        {life.sideQuestTriggered ? "线索已收下" : sideQuestUnlocked ? "触发线索" : "尚未解锁"}
                      </Button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#899b92]">解锁条件：{life.sideQuest.condition}</p>
                    <p className="mt-1 text-sm leading-6 text-[#aeb9b2]">{life.sideQuest.summary}</p>
                  </div>

                  {!life.training ? (
                    <div>
                      <p className="text-sm tracking-[0.16em] text-[#7ea28f]">七岁 · 第一次选择</p>
                      <h2 className="mt-2 text-xl text-[#f0dfae]">山门测验前，你如何度过这几年？</h2>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {TRAINING_CHOICES.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => selectTraining(choice.id)}
                            className="choice-card rounded-md border border-[#314b40] bg-[#091511] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8c7950] hover:bg-[#10211b]"
                          >
                            <span className="text-[#ead9a5]">{choice.title}</span>
                            <span className="mt-2 block text-sm leading-6 text-[#8fa097]">{choice.description}</span>
                            <span className="mt-3 block text-xs text-[#c49975]">{choice.risk}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-[#2f493e] bg-[#08130f] p-5">
                      <p className="text-sm text-[#7f9589]">童年修行已定：{life.training.title}</p>
                      <h2 className="mt-2 text-xl text-[#efdfb0]">青崖门木傀试炼</h2>
                      <p className="mt-2 leading-7 text-[#aebbb4]">
                        你只需决定是否入阵。攻防、先手与应变全部由程序比较，详细过程收在右侧小窗。
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {(!life.battle || life.battle.outcome === "defeat") && (
                          <Button onClick={startTrial} className="bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
                            <Swords className="h-4 w-4" />
                            {life.battle?.outcome === "defeat" ? "调息后再战" : "开始自动战斗"}
                          </Button>
                        )}
                        <span className="text-xs text-[#bc8d78]">风险：可能受伤 · 序章保护不会死亡</span>
                      </div>
                      {life.battle && life.battle.outcome !== "defeat" && (
                        <div className="mt-4 border-t border-[#29443a] pt-4 text-sm text-[#9fc6b3]">
                          锻体境主线试玩进度 1 / 1。正式版会在突破后立刻送达下一境界主线。
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <section className="ink-panel rounded-lg border border-[#29443a] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg text-[#f0dfae]">此世命格</h2>
                  <span className="text-sm text-[#82968c]">{life ? `${life.realm} · ${life.level}级` : "尚未降生"}</span>
                </div>
                {life ? (
                  <>
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
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[#71847a]">Roll 点后，这里只展示战斗真正需要的五维与两条资源。</p>
                )}
              </section>

              <section className="battle-window ink-panel rounded-lg border border-[#3f554b] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg text-[#f0dfae]">
                    <Swords className="h-5 w-5" />
                    战斗演算
                  </h2>
                  <span className="rounded-full border border-[#3d554a] px-2.5 py-1 text-xs text-[#82968c]">自动</span>
                </div>
                {life?.battle ? (
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
                    <div className={`mt-4 rounded-md border p-4 ${life.battle.outcome === "defeat" ? "border-[#73443b] bg-[#2a1714]" : "border-[#486a58] bg-[#10241c]"}`}>
                      <p className="text-lg text-[#f1dfaa]">{life.battle.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#aebbb4]">{life.battle.summary}</p>
                      <p className="mt-2 text-sm text-[#d4b875]">{life.battle.reward}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-[#31483e] px-4 py-6 text-center">
                    <p className="text-sm text-[#71847a]">尚无战斗</p>
                    <p className="mt-2 text-xs leading-5 text-[#566b61]">开战后只显示四项关键比较，并立刻给出战果。</p>
                  </div>
                )}
              </section>

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
                    <div key={player.id} className="flex items-center gap-3 rounded-md border border-[#284138] bg-[#091511] px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#e7ebe4]">{player.name}</p>
                        <p className="text-xs text-[#74877e]">{player.isHost ? content.world.hostRole : content.world.playerRole}</p>
                      </div>
                      {player.id === session.playerId && <span className="text-xs text-[#d6b66d]">{content.world.currentPlayer}</span>}
                    </div>
                  ))}
                </div>
                <Button onClick={copyInvite} size="sm" className="mt-4 w-full bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
                  <Copy className="h-4 w-4" />
                  {copied ? content.world.copiedInvite : content.world.copyInvite}
                </Button>
                {error && <p className="mt-3 text-sm text-[#e99580]">{error}</p>}
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
