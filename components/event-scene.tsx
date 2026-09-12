"use client";

import { BookOpen, ChevronRight, Dices, ScrollText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  choiceRequirementMessage,
  currentMainline,
  currentRandomEvent,
  type EventLibraryConfig,
} from "@/lib/events";
import type { PrologueLife } from "@/lib/prologue";

type EventSceneProps = {
  life: PrologueLife;
  config: EventLibraryConfig;
  onChoose(choiceId: string): void;
  onContinue(): void;
};

const OUTCOME_LABELS = {
  criticalFailure: "大失败",
  failure: "失败",
  success: "成功",
  criticalSuccess: "大成功",
  fixed: "已决定",
};

export function EventScene({ life, config, onChoose, onContinue }: EventSceneProps) {
  const adventure = life.adventure;
  if (!adventure) return null;
  const event = currentRandomEvent(life, config);
  const mainline = currentMainline(config, adventure);
  const resolution = adventure.lastResolution;
  const targetCount = config.stage.randomEncountersPerLife;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-[#35584a] bg-[#0a1a15] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[#e8d79e]">
            <ScrollText className="h-4 w-4" />
            锻体境主线 · {mainline?.title ?? "离开青石村"}
          </p>
          <span className="rounded-full bg-[#234d3d] px-3 py-1 text-xs text-[#bde2d0]">
            经历 {adventure.resolvedCount} / {targetCount}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#aebbb4]">
          {adventure.stageComplete ? config.stage.completion.nextStageHint : mainline?.guidance}
        </p>
      </div>

      {resolution ? (
        <div className="rounded-lg border border-[#65583b] bg-[#17170f]/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm tracking-[0.18em] text-[#a8996e]">事件结算</p>
              <h2 className="mt-2 text-2xl text-[#f0dfae]">{resolution.title}</h2>
            </div>
            <span className="rounded-full border border-[#65583b] px-3 py-1 text-xs text-[#dfc982]">
              {OUTCOME_LABELS[resolution.outcome]}
            </span>
          </div>
          <p className="mt-4 text-sm text-[#87998f]">你的选择：{resolution.choiceText}</p>
          <p className="mt-4 leading-8 text-[#c6cec8]">{resolution.resultText}</p>

          {(resolution.itemMessages.length > 0 || resolution.uselessItemNames.length > 0) && (
            <div className="mt-4 space-y-2 rounded border border-[#4d4931] bg-[#12150e] p-4">
              {resolution.itemMessages.map((message) => (
                <p key={message} className="text-sm text-[#d9c081]">奇效：{message}</p>
              ))}
              {resolution.uselessItemNames.map((name) => (
                <p key={name} className="text-sm text-[#89978f]">「{name}」在这里派不上用场，已原样保留。</p>
              ))}
            </div>
          )}

          {resolution.effectSummaries.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {resolution.effectSummaries.map((summary, index) => (
                <span key={`${summary}-${index}`} className="rounded border border-[#3f594c] bg-[#10211b] px-3 py-1 text-xs text-[#acd0bd]">
                  {summary}
                </span>
              ))}
            </div>
          )}

          <Button onClick={onContinue} className="mt-6 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
            {adventure.stageComplete ? "完成新手村阶段" : "继续前行"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : adventure.stageComplete ? (
        <div className="rounded-lg border border-[#59705f] bg-[#10241c] p-6 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-[#d6b66d]" />
          <h2 className="mt-3 text-2xl text-[#f0dfae]">新手村阶段完成</h2>
          <p className="mt-3 leading-7 text-[#aebbb4]">{config.stage.completion.nextStageHint}</p>
          <p className="mt-2 text-sm text-[#7f9589]">当前版本暂时开放至 10 级，下一阶段事件库接入后可继续。</p>
        </div>
      ) : event ? (
        <div className="rounded-lg border border-[#314b40] bg-[#091511] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm tracking-[0.18em] text-[#7ea28f]">
                <Dices className="h-4 w-4" />
                随机事件 · {event.tags.join(" / ")}
              </p>
              <h2 className="mt-2 text-2xl text-[#f0dfae]">{event.title}</h2>
            </div>
            <span className="rounded-full border border-[#3f594c] px-3 py-1 text-xs text-[#9ab0a4]">
              适合 {event.levelRange[0]}—{event.levelRange[1]} 级
            </span>
          </div>
          <p className="mt-5 leading-8 text-[#c1cac4]">{event.intro}</p>

          <div className="mt-6 space-y-3">
            {event.choices.map((choice) => {
              const requirement = choiceRequirementMessage(choice, life);
              const risk = config.riskGrades[choice.risk.grade];
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={Boolean(requirement)}
                  onClick={() => onChoose(choice.id)}
                  className="choice-card w-full rounded-md border border-[#314b40] bg-[#08130f] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8c7950] hover:bg-[#10211b] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[#ead9a5]">{choice.text}</span>
                    <span className={choice.risk.grade === "none" ? "text-xs text-[#7fae96]" : "text-xs text-[#d19a78]"}>
                      {risk.label}{choice.risk.primaryStat ? ` · ${config.statLabels[choice.risk.primaryStat]}判定` : ""}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[#899b92]">
                    {requirement || choice.risk.failureHint}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#71847a]">
            可先在右侧背包勾选任意道具。结算时只有符合当前场景的道具生效，无用道具不会消耗。
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-[#31483e] px-4 py-8 text-center text-[#71847a]">
          暂时没有可以抽取的事件。
        </div>
      )}

      {adventure.history.length > 0 && (
        <details className="rounded-md border border-[#2c443a] bg-[#08130f] p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-[#aab9b1]">
            <BookOpen className="h-4 w-4" />
            此世履历 · {adventure.history.length} 条
          </summary>
          <div className="mt-4 space-y-3 border-t border-[#29443a] pt-4">
            {[...adventure.history].reverse().map((entry) => (
              <div key={entry.resolutionId} className="text-sm">
                <p className="text-[#ddc98f]">{entry.title} · {OUTCOME_LABELS[entry.outcome]}</p>
                <p className="mt-1 leading-6 text-[#84958c]">{entry.resultText}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
