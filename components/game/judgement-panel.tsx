"use client";

import { Dices, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventJudgement } from "@/components/event-judgement";
import type { PrologueConfig, PrologueLife } from "@/lib/prologue";

type JudgementPanelProps = {
  life: PrologueLife;
  config: PrologueConfig;
  pendingChoiceText?: string;
  eventDiceRolling: boolean;
  eventResolutionReady: boolean;
  trialAwaitingRoll: boolean;
  trialDiceRolling: boolean;
  onRollEvent(): void;
  onCancelEvent(): void;
  onRollTrial(forcedRoll?: number): void;
};

export function JudgementPanel({
  life,
  config,
  pendingChoiceText,
  eventDiceRolling,
  eventResolutionReady,
  trialAwaitingRoll,
  trialDiceRolling,
  onRollEvent,
  onCancelEvent,
  onRollTrial,
}: JudgementPanelProps) {
  return (
    <section className="order-1 shrink-0 overflow-y-auto rounded-lg border border-[#3f554b] p-4 ink-panel lg:max-h-[46%] [scrollbar-color:#3b584a_#08130f] [scrollbar-width:thin]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg text-[#f0dfae]"><Swords className="h-5 w-5" />{life.adventure ? "事件判定" : config.trial.windowTitle}</h2>
        <span className="rounded-full border border-[#3d554a] px-2.5 py-1 text-xs text-[#82968c]">
          {life.adventure
            ? eventDiceRolling
              ? "掷骰中"
              : life.adventure.lastResolution
                ? eventResolutionReady ? "判定完成" : "命数揭示中"
                : pendingChoiceText ? "等待掷骰" : "等待选择"
            : trialDiceRolling
              ? "D10 转动中"
              : trialAwaitingRoll
                ? "等待 D10"
                : config.trial.windowBadge}
        </span>
      </div>
      {life.adventure ? (
        <EventJudgement
          resolution={life.adventure.lastResolution}
          pendingChoiceText={pendingChoiceText}
          rolling={eventDiceRolling}
          onRoll={onRollEvent}
          onCancel={onCancelEvent}
        />
      ) : trialAwaitingRoll ? (
        <div className="mt-4 rounded-md border border-[#4b5239] bg-[#10170f] px-4 py-5 text-center">
          <p className="text-xs text-[#83958b]">木傀已立于阵中</p>
          <p className="mt-1 text-sm text-[#dfcf9e]">木傀四项判定较高，投出 1—10 点加入你的全部比较。</p>
          <button
            type="button"
            disabled={trialDiceRolling}
            onClick={() => onRollTrial()}
            className="group mx-auto mt-4 grid h-24 w-24 place-items-center rounded-2xl border border-[#806b3d] bg-[radial-gradient(circle_at_35%_25%,#3a321d,#16150e_65%)] text-[#efd27b] shadow-[0_0_28px_rgba(214,182,109,0.14)] transition hover:-translate-y-1 hover:border-[#c6a755] disabled:cursor-wait disabled:hover:translate-y-0"
            aria-label={trialDiceRolling ? "十面命数骰转动中" : "投掷十面命数骰"}
          >
            <Dices className={`h-10 w-10 ${trialDiceRolling ? "dice-cast" : "transition group-hover:rotate-12 group-hover:scale-110"}`} />
          </button>
          <p className="mt-3 text-sm text-[#b9aa7b]">{trialDiceRolling ? "命数翻转中……" : "点击投掷 D10"}</p>
          <Button variant="ghost" size="sm" disabled={trialDiceRolling} onClick={() => onRollTrial(1)} className="mt-1 text-xs text-[#8e786b] hover:bg-[#291b17] hover:text-[#dc9a85]">
            TEST · 固定投出 1 点
          </Button>
        </div>
      ) : life.battle ? (
        <div className="mt-4">
          {life.battle.fateRoll !== undefined && (
            <div className="mb-3 flex items-center justify-between rounded border border-[#5b4e31] bg-[#17160e] px-3 py-2">
              <span className="text-sm text-[#a99b74]">十面命数骰</span>
              <span className="font-mono text-xl text-[#ecd58e]">D10 · {life.battle.fateRoll}</span>
            </div>
          )}
          <div className="space-y-2">
            {life.battle.comparisons.map((item) => (
              <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded border border-[#253b32] bg-[#08120f] px-3 py-2 text-sm">
                <span className="text-[#93a59b]">{item.label}</span>
                <span className={item.player >= item.enemy ? "text-[#8fc9aa]" : "text-[#d58b79]"}>{item.player} : {item.enemy} · {item.verdict}</span>
              </div>
            ))}
          </div>
          {(life.battle.itemMessages ?? []).length > 0 && (
            <div className="mt-3 space-y-1 rounded border border-[#5b4e31] bg-[#1b170e] px-3 py-2">
              {life.battle.itemMessages?.map((message) => <p key={message} className="text-xs leading-5 text-[#d9c081]">{message}</p>)}
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
          <p className="text-sm text-[#71847a]">{config.trial.emptyTitle}</p>
          <p className="mt-2 text-xs leading-5 text-[#566b61]">{config.trial.emptyText}</p>
        </div>
      )}
    </section>
  );
}
