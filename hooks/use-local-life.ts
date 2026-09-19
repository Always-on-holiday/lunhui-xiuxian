"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  LIFE_KEY,
  PAST_LIVES_KEY,
  type PastLifeArchiveEntry,
  type Session,
} from "@/lib/client/game-session";
import type { PrologueConfig, PrologueLife } from "@/lib/prologue";
import { normalizeLifeTimeline, tickLifeTime } from "@/lib/longevity";

type UseLocalLifeOptions = {
  session: Session | null;
  timeSystem: PrologueConfig["timeSystem"];
  setNotice: Dispatch<SetStateAction<string>>;
};

export function useLocalLife({ session, timeSystem, setNotice }: UseLocalLifeOptions) {
  const [life, setLife] = useState<PrologueLife | null>(null);
  const [pastLives, setPastLives] = useState<PastLifeArchiveEntry[]>([]);

  const persistLife = useCallback((next: PrologueLife) => {
    if (!session) return;
    const normalized = normalizeLifeTimeline(next, timeSystem);
    localStorage.setItem(`${LIFE_KEY}:${session.playerId}`, JSON.stringify(normalized));
    setLife(normalized);
  }, [session, timeSystem]);

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
      setNotice("本机存储空间不足，这一世尚未保存。");
      return false;
    }
  }, [session, setNotice]);

  const resetAllLives = useCallback(() => {
    if (!session) return;
    localStorage.removeItem(`${LIFE_KEY}:${session.playerId}`);
    localStorage.removeItem(`${PAST_LIVES_KEY}:${session.playerId}`);
    setPastLives([]);
    setNotice("");
    setLife(null);
  }, [session, setNotice]);

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
        restored = candidate.version === 1 ? normalizeLifeTimeline(candidate, timeSystem) : null;
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
  }, [session, timeSystem]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      setLife((current) => {
        if (!current || current.deathState) return current;
        const next = tickLifeTime(current, timeSystem);
        if (next === current) return current;
        localStorage.setItem(`${LIFE_KEY}:${session.playerId}`, JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session, timeSystem]);

  return {
    life,
    setLife,
    pastLives,
    persistLife,
    archiveCurrentLife,
    resetAllLives,
  };
}
