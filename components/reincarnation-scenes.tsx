"use client";

import { useState } from "react";
import { ChevronRight, Ghost, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InventoryItem, LearnedAbility, PrologueLife } from "@/lib/prologue";
import {
  isSoulExpired,
  type InheritedMemory,
  type ReincarnationConfig,
  type SoulActionConfig,
} from "@/lib/reincarnation";

export type RoomPlayerLife = {
  id: string;
  name: string;
  lifeStatus: "alive" | "soul" | "rebirth";
  soulPower: number;
  reviveDeadlineDay: number | null;
};

type SoulSceneProps = {
  life: PrologueLife;
  worldDay: number;
  players: RoomPlayerLife[];
  currentPlayerId: string;
  config: ReincarnationConfig;
  busy: boolean;
  onAct(action: SoulActionConfig, targetId?: string): void;
  onSelfRevive(): void;
};

export function SoulScene({ life, worldDay, players, currentPlayerId, config, busy, onAct, onSelfRevive }: SoulSceneProps) {
  const living = players.filter((player) => player.lifeStatus === "alive" && player.id !== currentPlayerId);
  const [targetId, setTargetId] = useState(living[0]?.id ?? "");
  const effectiveTargetId = living.some((player) => player.id === targetId) ? targetId : living[0]?.id ?? "";
  const death = life.deathState;
  if (!death) return null;
  const expired = isSoulExpired(death, worldDay);
  const actedToday = (death.lastActionDay ?? 0) >= worldDay;
  const selfMethod = config.revival.methods.find((method) => method.selfOnly);
  const selfCost = expired
    ? selfMethod?.expiredSoulPowerCost ?? selfMethod?.soulPowerCost ?? 0
    : selfMethod?.soulPowerCost ?? 0;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#655575] bg-[#15101d]/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm tracking-[0.18em] text-[#ae98bf]">
              <Ghost className="h-4 w-4" />
              {expired ? config.death.expiredTitle : config.soul.panelTitle}
            </p>
            <h2 className="mt-2 text-2xl text-[#eadcf0]">{config.death.title}</h2>
          </div>
          <span className="rounded-full border border-[#6c5a79] px-3 py-1 text-sm text-[#cdb7dc]">
            {config.soul.powerLabel} {death.soulPower}
          </span>
        </div>
        <p className="mt-4 leading-7 text-[#b9aebf]">{expired ? config.death.expiredText : config.death.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-[#241a2d] px-3 py-1.5 text-[#c9b5d6]">
            {config.soul.deadlineLabel}：{expired ? "已过期" : `${Math.max(0, death.deadlineDay - worldDay + 1)} 日`}
          </span>
          <span className="rounded bg-[#241a2d] px-3 py-1.5 text-[#c9b5d6]">
            {actedToday ? config.soul.actionSpent : config.soul.actionReady}
          </span>
          <span className="rounded bg-[#241a2d] px-3 py-1.5 text-[#c9b5d6]">
            保留 {life.realm} · {life.level}级
          </span>
        </div>
      </section>

      {living.length > 0 ? (
        <section className="rounded-lg border border-[#463b50] bg-[#0e0b13] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[#dfcfea]">今日残魂行动</h3>
              <p className="mt-1 text-sm text-[#84798c]">每个世界日只能选择一次；需要生者的行动会作用于所选目标。</p>
            </div>
            <select
              value={effectiveTargetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="rounded border border-[#574863] bg-[#17111e] px-3 py-2 text-sm text-[#d8c8df]"
            >
              {living.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {config.soul.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy || actedToday || (action.target === "living" && !effectiveTargetId)}
                onClick={() => onAct(action, action.target === "living" ? effectiveTargetId : undefined)}
                className="rounded border border-[#4a3d55] bg-[#17111e] p-4 text-left transition hover:border-[#8b70a0] hover:bg-[#211728] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center justify-between gap-2 text-[#e5d4ed]">
                  {action.title}
                  <small className="text-[#a989ba]">魂力 +{action.powerGain}</small>
                </span>
                <span className="mt-2 block text-sm leading-6 text-[#8f8396]">{action.description}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded border border-dashed border-[#4a3d55] p-5 text-center text-[#9c8aa8]">{config.soul.noLivingTarget}</p>
      )}

      {selfMethod && (
        <section className="rounded-lg border border-[#5c5335] bg-[#17150d] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[#e0c978]">{selfMethod.title}</p>
              <p className="mt-1 text-sm text-[#91876a]">{selfMethod.description}　需要魂力 {selfCost}</p>
            </div>
            <Button disabled={busy || death.soulPower < selfCost} onClick={onSelfRevive} className="bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
              <Sparkles className="h-4 w-4" />自行还阳
            </Button>
          </div>
        </section>
      )}

      {death.history.length > 0 && (
        <details className="rounded border border-[#463b50] bg-[#0e0b13] p-4">
          <summary className="cursor-pointer text-sm text-[#bca8c8]">{config.soul.historyTitle} · {death.history.length} 条</summary>
          <div className="mt-4 space-y-3 border-t border-[#463b50] pt-4">
            {[...death.history].reverse().map((entry) => (
              <div key={entry.id} className="rounded bg-[#17111e] p-3 text-sm">
                <p className="text-[#d8c6e1]">第 {entry.worldDay} 日 · {entry.title}{entry.targetName ? ` → ${entry.targetName}` : ""}</p>
                <p className="mt-1 leading-6 text-[#887c90]">{entry.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

type InheritanceSceneProps = {
  cycle: number;
  config: ReincarnationConfig;
  arts: LearnedAbility[];
  items: InventoryItem[];
  memories: InheritedMemory[];
  onBegin(selection: { artId?: string; itemId?: string; memoryId?: string }): void;
};

export function InheritanceScene({ cycle, config, arts, items, memories, onBegin }: InheritanceSceneProps) {
  const [artId, setArtId] = useState("");
  const [itemId, setItemId] = useState("");
  const [memoryId, setMemoryId] = useState("");
  const rows = [
    { label: config.inheritance.artLabel, value: artId, setValue: setArtId, options: arts },
    { label: config.inheritance.itemLabel, value: itemId, setValue: setItemId, options: items },
    { label: config.inheritance.memoryLabel, value: memoryId, setValue: setMemoryId, options: memories },
  ];
  return (
    <section className="rounded-lg border border-[#65583b] bg-[#15150e] p-5 sm:p-6">
      <p className="text-sm tracking-[0.18em] text-[#aa9662]">第 {cycle} 世 · 天地重开</p>
      <h2 className="mt-2 flex items-center gap-2 text-2xl text-[#f0dfae]"><RotateCcw className="h-5 w-5" />{config.inheritance.title}</h2>
      <p className="mt-4 leading-7 text-[#aaa994]">{config.inheritance.summary}</p>
      <div className="mt-5 grid gap-3">
        {rows.map((row) => (
          <label key={row.label} className="grid gap-2 rounded border border-[#4b432d] bg-[#0e100b] p-4 sm:grid-cols-[8rem_1fr] sm:items-center">
            <span className="text-sm text-[#d6c58d]">{row.label}</span>
            <select value={row.value} onChange={(event) => row.setValue(event.target.value)} className="rounded border border-[#51472e] bg-[#15170f] px-3 py-2 text-sm text-[#ddd5b7]">
              <option value="">{config.inheritance.noneLabel}</option>
              {row.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <Button onClick={() => onBegin({ artId: artId || undefined, itemId: itemId || undefined, memoryId: memoryId || undefined })} className="mt-5 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
        {config.inheritance.beginButton}<ChevronRight className="h-4 w-4" />
      </Button>
    </section>
  );
}

export function CycleSecretScene({ life, config, onChoose, onContinue }: {
  life: PrologueLife;
  config: ReincarnationConfig;
  onChoose(choiceId: string): void;
  onContinue(): void;
}) {
  const state = life.cycleSecret;
  return (
    <section className="rounded-lg border border-[#5b4c70] bg-[#120e19] p-5 sm:p-6">
      <p className="text-sm tracking-[0.18em] text-[#a88dba]">{config.cycleSecret.eyebrow}</p>
      <h2 className="mt-2 text-2xl text-[#eadcf0]">{state?.resultTitle ?? config.cycleSecret.title}</h2>
      <p className="mt-4 leading-8 text-[#bcb0c4]">{state?.resultText ?? config.cycleSecret.intro}</p>
      {state?.resolved ? (
        <Button onClick={onContinue} className="mt-6 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
          {config.cycleSecret.continueButton}<ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {config.cycleSecret.choices.map((choice) => {
            const unavailable = Boolean(choice.requiresArtId && !life.cultivationArts?.some((art) => art.id === choice.requiresArtId));
            return (
              <button key={choice.id} disabled={unavailable} onClick={() => onChoose(choice.id)} className="rounded border border-[#4e405d] bg-[#191221] p-4 text-left text-[#e3d2ea] hover:border-[#8a6da0] disabled:opacity-35">
                {choice.title}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
