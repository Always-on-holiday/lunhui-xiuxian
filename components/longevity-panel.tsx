import { Hourglass, TimerReset } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  approximateYears,
  formatYearsAndDays,
  type TimeSystemRules,
} from "@/lib/longevity";
import type { PrologueLife } from "@/lib/prologue";

type LongevityPanelProps = {
  life: PrologueLife;
  rules: TimeSystemRules;
};

export function LongevityPanel({ life, rules }: LongevityPanelProps) {
  const timeline = life.timeline;
  if (!timeline) return null;
  const remainingDays = Math.max(0, timeline.lifespanDays - timeline.ageDays);
  const remainingPercent = timeline.lifespanDays > 0
    ? Math.max(0, Math.min(100, remainingDays / timeline.lifespanDays * 100))
    : 0;
  const expired = remainingDays <= 0;

  return (
    <section className={`ink-panel rounded-lg border p-5 ${expired ? "border-[#73443b]" : "border-[#5b5034]"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg text-[#f0dfae]">
          <Hourglass className="h-4 w-4" />
          阳寿
        </h2>
        <span className={expired ? "text-sm text-[#e99580]" : "text-sm text-[#d6b66d]"}>
          {expired ? "寿尽" : `约 ${approximateYears(timeline.lifespanDays, rules.daysPerYear)} 年`}
        </span>
      </div>

      <p className="mt-3 text-sm text-[#aebbb4]">
        总寿元约 {approximateYears(timeline.lifespanDays, rules.daysPerYear)} 年
        <span className="text-[#7f9288]">（{timeline.lifespanDays.toLocaleString("zh-CN")} 天）</span>
      </p>
      <Progress
        value={remainingPercent}
        aria-label={`剩余寿元 ${remainingDays} 天`}
        className="mt-3 bg-[#2b2117] [&_[data-slot=progress-indicator]]:bg-[#c3a45f]"
      />
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[#71847a]">当前年龄</p>
          <p className="mt-1 text-[#d8dfda]">{formatYearsAndDays(timeline.ageDays, rules.daysPerYear)}</p>
        </div>
        <div>
          <p className="text-[#71847a]">剩余寿元</p>
          <p className={`mt-1 ${expired ? "text-[#e99580]" : "text-[#d8dfda]"}`}>
            {formatYearsAndDays(remainingDays, rules.daysPerYear)}（{remainingDays.toLocaleString("zh-CN")} 天）
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 border-t border-[#3c422f] pt-3 text-xs leading-5 text-[#7f9288]">
        <TimerReset className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        无操作时，每 {rules.realSecondsPerDay} 秒流逝一日；修炼与事件会一次消耗更多时间。
      </p>
      {timeline.lastTimeCost && (
        <p className="mt-2 text-xs text-[#bda66c]">
          最近：{timeline.lastTimeCost.reason} · {timeline.lastTimeCost.days} 天
        </p>
      )}
    </section>
  );
}
