import type { PrologueLife } from "@/lib/prologue";

export type Player = {
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

export type Room = {
  code: string;
  pvpEnabled: boolean;
  createdAt: string;
  worldDay: number;
  cycle: number;
  players: Player[];
};

export type Session = {
  code: string;
  playerId: string;
  name: string;
};

export type PastLifeArchiveEntry = {
  id: string;
  archivedAt: string;
  playerName: string;
  roomCode: string;
  life: PrologueLife;
};

export type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): Promise<unknown>;
};

export type ModelContext = {
  registerTool(tool: ToolRegistration, options?: { signal?: AbortSignal }): void | Promise<void>;
};

export const SESSION_KEY = "lunhui-xiuxian-session";
export const LIFE_KEY = "lunhui-xiuxian-prologue-v1";
export const PAST_LIVES_KEY = "lunhui-xiuxian-past-lives-v1";

export async function readApiJson(response: Response) {
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "请求失败。");
  }
  return data;
}
