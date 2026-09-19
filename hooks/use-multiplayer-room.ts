"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SESSION_KEY,
  readApiJson,
  type ModelContext,
  type Room,
  type Session,
} from "@/lib/client/game-session";

export function useMultiplayerRoom() {
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
    const data = await readApiJson(response) as unknown as { room: Room };
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
      const data = await readApiJson(response) as { code: string; playerId: string };
      const next = { code: data.code, playerId: data.playerId, name: creatorName.trim() };
      enterSession(next);
      await refreshRoom(data.code);
      return { code: data.code, pvpEnabled: pvp };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "开辟世界失败。");
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
      const data = await readApiJson(response) as { code: string; playerId: string };
      const next = { code: data.code, playerId: data.playerId, name: joinName.trim() };
      enterSession(next);
      await refreshRoom(data.code);
      return { code: data.code, joined: true };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "进入世界失败。");
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [enterSession, refreshRoom]);

  const performRoomAction = useCallback(async (body: Record<string, unknown>) => {
    if (!session) throw new Error("尚未进入世界。");
    const response = await fetch(`/api/rooms/${session.code}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, playerId: session.playerId }),
    });
    const data = await readApiJson(response) as unknown as { room: Room; soulPower?: number; drained?: number };
    if (data.room) setRoom(data.room);
    return data;
  }, [session]);

  const copyInvite = useCallback(async () => {
    if (!session) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?room=${session.code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [session]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setCopied(false);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

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
    const timer = window.setInterval(() => void refreshRoom().catch(() => undefined), 4000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
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

  return {
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
  };
}
