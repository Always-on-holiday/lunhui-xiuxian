import { Check, ChevronRight, Dices, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BirthStep, FiveStats, PrologueConfig, PrologueLife } from "@/lib/prologue";

const STAT_LABELS: Array<{ key: keyof FiveStats; label: string }> = [
  { key: "attack", label: "攻击" },
  { key: "defense", label: "防御" },
  { key: "speed", label: "速度" },
  { key: "intelligence", label: "智力" },
  { key: "proficiency", label: "熟练" },
];

type BirthFlowProps = {
  life: PrologueLife;
  config: PrologueConfig;
  step: Exclude<BirthStep, "ready">;
  onContinue(): void;
  onChangeStat(stat: keyof FiveStats, direction: 1 | -1): void;
  onConfirmStats(): void;
};

export function BirthFlow({ life, config, step, onContinue, onChangeStat, onConfirmStats }: BirthFlowProps) {
  const steps = [
    { id: "origin", label: config.character.originStepLabel },
    { id: "root", label: config.character.rootStepLabel },
    { id: "allocation", label: config.character.allocationStepLabel },
  ] as const;
  const activeIndex = steps.findIndex((item) => item.id === step);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-md border border-[#2c443a] bg-[#08130f] px-4 py-3">
        <p className="mb-3 text-center text-xs tracking-[0.18em] text-[#71847a]">{config.character.birthProgressTitle}</p>
        <div className="grid grid-cols-3 gap-2">
          {steps.map((item, index) => (
            <div key={item.id} className="text-center">
              <div className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-xs ${
                index === activeIndex
                  ? "border-[#d6b66d] bg-[#44391f] text-[#f1d88e]"
                  : index < activeIndex
                    ? "border-[#47705c] bg-[#173b2c] text-[#9ed0b4]"
                    : "border-[#31463d] text-[#5f746a]"
              }`}>
                {index < activeIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <p className={`mt-1 text-xs ${index === activeIndex ? "text-[#e4d29b]" : "text-[#667a70]"}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {step === "origin" && life.origin && (
        <section className="rounded-lg border border-[#365347] bg-[#091511] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm tracking-[0.18em] text-[#7f9589]">第一步 · {config.character.originResultLabel}</p>
            {life.originRoll && (
              <span className="flex items-center gap-1 rounded-full border border-[#40584c] px-2.5 py-1 font-mono text-xs text-[#a8b8af]">
                <Dices className="h-3.5 w-3.5" />
                {config.character.originRollLabel} {life.originRoll.value} / {life.originRoll.maximum}
              </span>
            )}
          </div>
          <h2 className="mt-5 text-3xl text-[#efd48d]">{life.origin.name}</h2>
          <p className="mt-4 leading-8 text-[#aebbb4]">{life.origin.description}</p>
          <p className="mt-3 text-sm leading-6 text-[#7f9288]">{life.birthText}</p>
          <Button onClick={onContinue} className="mt-7 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
            {config.character.originContinueButton}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </section>
      )}

      {step === "root" && (
        <section className="rounded-lg border border-[#665630] bg-[#17170f] p-6 sm:p-8">
          <p className="text-sm tracking-[0.18em] text-[#a8996e]">第二步 · 测灵结果</p>
          <div className="mt-5 flex items-start gap-4">
            <Sparkles className="mt-1 h-6 w-6 shrink-0 text-[#d6b66d]" />
            <div>
              <h2 className="text-3xl text-[#efd48d]">{life.root.name}</h2>
              <p className="mt-4 leading-8 text-[#c5c7b9]">{life.root.reception}</p>
              <div className="mt-5 rounded border border-[#4b5038] bg-[#10150f] p-4">
                <p className="text-sm text-[#d8c98e]">天赋「{life.root.talent}」</p>
                <p className="mt-2 text-sm leading-6 text-[#91a39a]">{life.root.talentText}</p>
              </div>
            </div>
          </div>
          <Button onClick={onContinue} className="mt-7 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
            {config.character.rootContinueButton}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </section>
      )}

      {step === "allocation" && (
        <section className="rounded-lg border border-[#5a4c2d] bg-[#15150e] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm tracking-[0.16em] text-[#a8996e]">第三步 · 初始塑命</p>
              <h2 className="mt-1 text-2xl text-[#efd48d]">{config.character.allocationTitle}</h2>
            </div>
            <span className="rounded-full bg-[#3c321c] px-3 py-1 text-sm text-[#efd48d]">
              {config.character.allocationRemainingLabel}：{life.unspentStatPoints ?? 0}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#aeb8b1]">{config.character.allocationDescription}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            {STAT_LABELS.map(({ key, label }) => {
              const allocated = life.statAllocation?.[key] ?? 0;
              const maximum = config.birth.stats.allocationMaximumPerStat ?? 3;
              return (
                <div key={key} className="rounded border border-[#3b4d43] bg-[#09120f] p-3 text-center">
                  <p className="text-xs text-[#87988f]">{label}</p>
                  <p className="mt-1 font-mono text-lg text-[#f0dfae]">
                    {life.stats[key]}
                    {allocated > 0 && <span className="ml-1 text-xs text-[#76b995]">(+{allocated})</span>}
                  </p>
                  <div className="mt-2 flex justify-center gap-1">
                    <Button type="button" size="icon-sm" variant="outline" disabled={allocated <= 0} onClick={() => onChangeStat(key, -1)} className="border-[#3b5147] bg-transparent text-[#aebdb5] hover:bg-[#17352c]" aria-label={`减少${label}`}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="outline" disabled={(life.unspentStatPoints ?? 0) <= 0 || allocated >= maximum} onClick={() => onChangeStat(key, 1)} className="border-[#6a5930] bg-transparent text-[#e1c878] hover:bg-[#342d1b]" aria-label={`增加${label}`}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button type="button" disabled={(life.unspentStatPoints ?? 0) > 0} onClick={onConfirmStats} className="mt-5 bg-[#d6b66d] text-[#102019] hover:bg-[#e7cc8b]">
            <Check className="h-4 w-4" />
            {config.character.allocationConfirmButton}
          </Button>
        </section>
      )}
    </div>
  );
}
