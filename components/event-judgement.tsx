"use client";

import { useEffect, useState } from "react";
import { Dices, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventCalculation, EventResolution } from "@/lib/events";

type EventJudgementProps = {
  resolution?: EventResolution;
  pendingChoiceText?: string;
  rolling: boolean;
  onRoll(): void;
  onCancel(): void;
};

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function TypewriterText({ text }: { text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= text.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 32);
    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <span>
      {text.slice(0, visibleLength)}
      {visibleLength < text.length && <span className="typewriter-caret" aria-hidden>│</span>}
    </span>
  );
}

function CalculationRow({ label, value, step, revealStep }: {
  label: string;
  value: string;
  step: number;
  revealStep: number;
}) {
  if (revealStep < step) return null;
  return (
    <div className="judgement-reveal grid grid-cols-[1fr_auto] gap-3 rounded border border-[#253b32] bg-[#08120f] px-3 py-2 text-sm">
      <span className="text-[#93a59b]">{label}</span>
      <span className="font-mono text-[#d8dfda]">{value}</span>
    </div>
  );
}

function AnimatedComparison({ calculation }: { calculation: EventCalculation }) {
  const maximum = Math.max(1, calculation.total, calculation.difficulty);
  const playerWidth = Math.max(12, Math.round(calculation.total / maximum * 100));
  const difficultyWidth = Math.max(12, Math.round(calculation.difficulty / maximum * 100));
  const succeeded = calculation.margin >= 0;

  return (
    <div className="judgement-reveal rounded border border-[#4c604f] bg-[#101d18] p-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-[#8fa69a]">你的判定</p>
          <p className={`mt-1 font-mono text-xl ${succeeded ? "text-[#92d1ae]" : "text-[#e09a87]"}`}>{calculation.total}</p>
          <div className="mt-2 flex h-1.5 justify-end overflow-hidden rounded-full bg-[#17261f]">
            <div className="judgement-fill-left h-full rounded-full bg-[#78b995]" style={{ width: `${playerWidth}%` }} />
          </div>
        </div>
        <div className="judgement-impact grid h-9 w-9 place-items-center rounded-full border border-[#7b6840] bg-[#211c10] text-xs text-[#e2c87f]">
          VS
        </div>
        <div>
          <p className="text-xs text-[#8fa69a]">事件难度</p>
          <p className="mt-1 font-mono text-xl text-[#d7c9a0]">{calculation.difficulty}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#17261f]">
            <div className="judgement-fill-right h-full rounded-full bg-[#bd725f]" style={{ width: `${difficultyWidth}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResolvedJudgement({ resolution }: { resolution: EventResolution }) {
  const [revealStep, setRevealStep] = useState(0);
  const calculation = resolution.calculation;

  useEffect(() => {
    const timers = [180, 520, 860, 1250, 1680].map((delay, index) => (
      window.setTimeout(() => setRevealStep(index + 1), delay)
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  if (!calculation) {
    return (
      <div className="mt-4 space-y-3">
        <p className="judgement-reveal rounded border border-[#253b32] bg-[#08120f] px-3 py-3 text-sm text-[#93a59b]">
          此选项无需数值判定，命数落定。
        </p>
        <div className="judgement-reveal rounded-md border border-[#486a58] bg-[#10241c] p-4">
          <p className="text-lg text-[#f1dfaa]">{resolution.title}</p>
          <p className="mt-2 text-sm leading-6 text-[#aebbb4]"><TypewriterText text={resolution.resultText} /></p>
        </div>
      </div>
    );
  }

  const abilityBonus = calculation.cultivationBonus + calculation.techniqueBonus + calculation.modifierBonus;
  const diceFace = DICE_FACES[Math.max(0, Math.min(5, calculation.randomRoll))];

  return (
    <div className="mt-4 space-y-2">
      <CalculationRow label={calculation.statLabel} value={String(calculation.statValue)} step={1} revealStep={revealStep} />
      <CalculationRow label="功法 / 技法 / 特性" value={`+${abilityBonus}`} step={2} revealStep={revealStep} />
      <CalculationRow label="道具加成" value={`+${calculation.itemBonus}`} step={3} revealStep={revealStep} />
      {revealStep >= 3 && (
        <div className="judgement-reveal flex items-center justify-between rounded border border-[#4b4630] bg-[#17160e] px-3 py-2">
          <span className="text-sm text-[#a99b74]">命数骰</span>
          <span className="flex items-center gap-2 font-mono text-[#ecd58e]">
            <span className="text-2xl leading-none">{diceFace}</span>
            +{calculation.randomRoll}
          </span>
        </div>
      )}
      {revealStep >= 4 && <AnimatedComparison calculation={calculation} />}
      {revealStep >= 5 && (
        <div className={`judgement-reveal rounded-md border p-4 ${calculation.margin >= 0 ? "border-[#486a58] bg-[#10241c]" : "border-[#73443b] bg-[#2a1714]"}`}>
          <p className="text-lg text-[#f1dfaa]">{resolution.title}</p>
          <p className="mt-2 text-sm leading-6 text-[#aebbb4]"><TypewriterText text={resolution.resultText} /></p>
        </div>
      )}
    </div>
  );
}

export function EventJudgement({ resolution, pendingChoiceText, rolling, onRoll, onCancel }: EventJudgementProps) {
  if (resolution) return <ResolvedJudgement key={resolution.resolutionId} resolution={resolution} />;

  if (pendingChoiceText) {
    return (
      <div className="mt-4 rounded-md border border-[#4b5239] bg-[#10170f] px-4 py-5 text-center">
        <p className="text-xs text-[#83958b]">你选择了</p>
        <p className="mt-1 text-sm text-[#dfcf9e]">{pendingChoiceText}</p>
        <button
          type="button"
          disabled={rolling}
          onClick={onRoll}
          className="group mx-auto mt-4 grid h-24 w-24 place-items-center rounded-2xl border border-[#806b3d] bg-[radial-gradient(circle_at_35%_25%,#3a321d,#16150e_65%)] text-[#efd27b] shadow-[0_0_28px_rgba(214,182,109,0.14)] transition hover:-translate-y-1 hover:border-[#c6a755] hover:shadow-[0_0_36px_rgba(214,182,109,0.24)] disabled:cursor-wait disabled:hover:translate-y-0"
          aria-label={rolling ? "命数骰转动中" : "点击投掷命数骰"}
        >
          <Dices className={`h-10 w-10 ${rolling ? "dice-cast" : "transition group-hover:rotate-12 group-hover:scale-110"}`} />
        </button>
        <p className="mt-3 text-sm text-[#b9aa7b]">{rolling ? "命数翻转中……" : "点击骰子，亲手落定结果"}</p>
        <Button variant="ghost" size="sm" disabled={rolling} onClick={onCancel} className="mt-1 text-xs text-[#71847a] hover:bg-[#17241f] hover:text-[#b7c5bd]">
          <RotateCcw className="h-3.5 w-3.5" />
          返回重选
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-dashed border-[#31483e] px-4 py-6 text-center">
      <Sparkles className="mx-auto h-5 w-5 text-[#6f806f]" />
      <p className="mt-2 text-sm text-[#71847a]">先在左侧选择做法</p>
      <p className="mt-2 text-xs leading-5 text-[#566b61]">选定后，由你亲手投掷命数骰。</p>
    </div>
  );
}
