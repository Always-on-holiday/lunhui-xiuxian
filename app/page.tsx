"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, Globe2, LogOut, Shield, Sparkles, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

async function readJson(response: Response) {
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "请求失败。");
  return data;
}

export default function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pvpEnabled, setPvpEnabled] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshRoom().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "世界暂时失去回应。");
    });
    const timer = window.setInterval(() => {
      void refreshRoom().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [refreshRoom, session]);

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
              <div className="seal grid h-10 w-10 place-items-center text-lg font-bold">轮</div>
              <div>
                <p className="text-lg tracking-[0.22em] text-[#f0dfae]">轮回仙途</p>
                <p className="text-sm text-[#82968c]">联机测试境</p>
              </div>
            </div>
            <Button variant="outline" onClick={leaveRoom} className="border-[#385248] bg-transparent text-[#bbc8c0] hover:bg-[#14241f] hover:text-white">
              <LogOut className="h-4 w-4" />
              离开此界
            </Button>
          </header>

          <section className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="ink-panel rounded-lg border border-[#29443a] p-5">
              <p className="text-sm text-[#82968c]">世界编号</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <strong className="font-mono text-2xl tracking-[0.22em] text-[#f0dfae]">{room.code}</strong>
                <Button size="sm" variant="ghost" onClick={copyInvite} className="text-[#9fb2a8] hover:bg-[#17352c] hover:text-white">
                  <Copy className="h-4 w-4" />
                  {copied ? "已复制" : "邀请"}
                </Button>
              </div>
            </div>
            <div className="ink-panel rounded-lg border border-[#29443a] p-5">
              <p className="text-sm text-[#82968c]">世界历</p>
              <p className="mt-2 text-2xl text-[#eef1e7]">第 {room.worldDay} 日</p>
            </div>
            <div className="ink-panel rounded-lg border border-[#29443a] p-5">
              <p className="text-sm text-[#82968c]">斗法规则</p>
              <p className="mt-2 flex items-center gap-2 text-2xl text-[#eef1e7]">
                {room.pvpEnabled ? <Swords className="h-5 w-5 text-[#d17a68]" /> : <Shield className="h-5 w-5 text-[#73b59a]" />}
                PVP {room.pvpEnabled ? "开启" : "关闭"}
              </p>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
            <section className="ink-panel min-h-[440px] rounded-lg border border-[#29443a] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm tracking-[0.2em] text-[#7ea28f]">青冥洲 · 无名渡</p>
                  <h1 className="mt-2 text-2xl text-[#f4e8c5] sm:text-3xl">诸位的第一世已经开始</h1>
                </div>
                <Sparkles className="slow-pulse h-6 w-6 text-[#d6b66d]" />
              </div>
              <div className="gold-rule my-6 h-px" />
              <div className="space-y-5 text-base leading-8 text-[#b8c5bd]">
                <p>天色未明，渡口的铜铃无风自响。四方灵气正在汇入此界，世界时间已经开始流动。</p>
                <p>目前开放的是联机房间原型：好友使用同一房间码进入后，会出现在右侧同界修士名录中。</p>
                <div className="rounded-md border border-[#2d483d] bg-[#08120f]/80 p-4">
                  <p className="text-sm text-[#789087]">天道告示</p>
                  <p className="mt-2 text-[#d9dfd7]">修炼、奇遇、自动战斗和死亡转生将在下一阶段接入。此版本先验证四人进入同一世界。</p>
                </div>
              </div>
            </section>

            <aside className="ink-panel rounded-lg border border-[#29443a] p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg text-[#f0dfae]">
                  <Users className="h-5 w-5" />
                  同界修士
                </h2>
                <span className="text-sm text-[#82968c]">{room.players.length} / 4</span>
              </div>
              <div className="mt-5 space-y-3">
                {room.players.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-md border border-[#284138] bg-[#091511] p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full border border-[#426052] bg-[#12251f] text-[#d9c487]">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#e7ebe4]">{player.name}</p>
                      <p className="text-sm text-[#74877e]">{player.isHost ? "界主" : "游方修士"}</p>
                    </div>
                    {player.id === session.playerId && <span className="text-sm text-[#d6b66d]">你</span>}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, index) => (
                  <div key={index} className="rounded-md border border-dashed border-[#284138] px-4 py-4 text-center text-sm text-[#667a70]">
                    等待有缘人
                  </div>
                ))}
              </div>
              <Button onClick={copyInvite} className="mt-5 w-full bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
                <Copy className="h-4 w-4" />
                {copied ? "邀请链接已复制" : "复制邀请链接"}
              </Button>
              {error && <p className="mt-3 text-sm text-[#e99580]">{error}</p>}
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
            <div className="seal grid h-10 w-10 place-items-center text-lg font-bold">轮</div>
            <div>
              <p className="text-lg tracking-[0.22em] text-[#f0dfae]">轮回仙途</p>
              <p className="text-sm text-[#82968c]">联机测试境</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#8aa296]">
            <span className="slow-pulse h-2 w-2 rounded-full bg-[#71b395]" />
            世界服务运行中
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-105px)] items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <p className="mb-4 flex items-center gap-2 text-sm tracking-[0.24em] text-[#7fa08f]">
              <Globe2 className="h-4 w-4" />
              四人共享 · 世界持续运行
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight text-[#f4e8c5] sm:text-6xl">
              同入一界，
              <span className="block text-[#d6b66d]">各走一生。</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#9fb0a7]">
              创建一个世界，把六位房间码发给好友。最多四名玩家可以进入同一片天地，见证彼此的轮回。
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["四人", "同界"],
                ["死亡", "转生"],
                ["永生", "终局"],
              ].map(([value, label]) => (
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
                <TabsTrigger value="create">开辟世界</TabsTrigger>
                <TabsTrigger value="join">加入世界</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-6">
                <form onSubmit={handleCreate} className="space-y-5">
                  <div>
                    <label htmlFor="create-name" className="mb-2 block text-sm text-[#9caf9f]">你的道号</label>
                    <Input
                      id="create-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="例如：听潮客"
                      minLength={2}
                      maxLength={16}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] text-base"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-[#2d483d] bg-[#091511] p-4">
                    <div>
                      <label htmlFor="pvp-switch" className="text-[#e2e8df]">允许玩家斗法</label>
                      <p className="mt-1 text-sm text-[#74877e]">关闭时，玩家只能合作与交易。</p>
                    </div>
                    <Switch id="pvp-switch" checked={pvpEnabled} onCheckedChange={setPvpEnabled} />
                  </div>
                  <Button type="submit" disabled={busy} className="h-12 w-full bg-[#d6b66d] text-base text-[#102019] hover:bg-[#e7cc8b]">
                    <Sparkles className="h-4 w-4" />
                    {busy ? "正在开辟…" : "生成房间码"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                <form onSubmit={handleJoin} className="space-y-5">
                  <div>
                    <label htmlFor="join-name" className="mb-2 block text-sm text-[#9caf9f]">你的道号</label>
                    <Input
                      id="join-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="例如：守山人"
                      minLength={2}
                      maxLength={16}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="room-code" className="mb-2 block text-sm text-[#9caf9f]">六位房间码</label>
                    <Input
                      id="room-code"
                      value={roomCode}
                      onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))}
                      placeholder="例如：Q7M2KR"
                      minLength={6}
                      maxLength={6}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] font-mono text-lg tracking-[0.22em]"
                    />
                  </div>
                  <Button type="submit" disabled={busy} className="h-12 w-full bg-[#d6b66d] text-base text-[#102019] hover:bg-[#e7cc8b]">
                    <Users className="h-4 w-4" />
                    {busy ? "正在入世…" : "凭房间码进入"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && <p role="alert" className="mt-4 rounded-md border border-[#743f36] bg-[#351b18] px-4 py-3 text-sm text-[#f0a08d]">{error}</p>}
            <p className="mt-5 text-center text-sm leading-6 text-[#6f8278]">公开测试原型，请勿填写真实姓名或隐私信息。</p>
          </section>
        </div>
      </div>
    </main>
  );
}
