import { Heart, Zap } from "lucide-react";
import { STAT_LABELS } from "@/lib/client/action-selection";
import type { PrologueConfig, PrologueLife } from "@/lib/prologue";

type CharacterPanelProps = {
  visible: boolean;
  life: PrologueLife | null;
  statAllocationReady: boolean;
  config: PrologueConfig;
};

export function CharacterPanel({ visible, life, statAllocationReady, config }: CharacterPanelProps) {
  return (
    <section className={`${visible ? "order-3 min-h-0 flex-1 overflow-y-auto" : "hidden"} ink-panel rounded-lg border border-[#29443a] p-4 [scrollbar-color:#3b584a_#08130f] [scrollbar-width:thin]`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-[#f0dfae]">{life && !statAllocationReady ? "入世进度" : "此世命格"}</h2>
        <span className="text-sm text-[#82968c]">{life && statAllocationReady ? `${life.realm} · ${life.level}级` : "尚未定命"}</span>
      </div>
      {life && statAllocationReady ? (
        <>
          <div className="mt-3 rounded border border-[#4a5036] bg-[#11170f] px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#82968c]">{config.character.rootSummaryLabel}</span>
              <strong className="text-sm font-normal text-[#e7d49c]">{life.root.name}</strong>
            </div>
            <p className="mt-1.5 text-xs text-[#8da096]" title={life.root.talentText}>
              {config.character.talentSummaryLabel}「{life.root.talent}」
            </p>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {STAT_LABELS.map(({ key, label }) => (
              <div key={key} className="rounded border border-[#29443a] bg-[#091511] px-2 py-2 text-center">
                <p className="text-xs text-[#71847a]">{label}</p>
                <p className="mt-1 font-mono text-lg text-[#e7d49c]">{life.stats[key]}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#b6c4bc]"><Heart className="h-4 w-4 text-[#d8796a]" />气血</span>
                <span className="font-mono text-[#d8dfda]">{life.currentHealth} / {life.maxHealth}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1b2823]">
                <div className="h-full rounded-full bg-[#b95f55]" style={{ width: `${Math.round((life.currentHealth / life.maxHealth) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#b6c4bc]"><Zap className="h-4 w-4 text-[#6e9fc0]" />灵力</span>
                <span className="font-mono text-[#d8dfda]">{life.currentSpirit} / {life.maxSpirit}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1b2823]">
                <div className="h-full rounded-full bg-[#5f91b5]" style={{ width: `${Math.round((life.currentSpirit / life.maxSpirit) * 100)}%` }} />
              </div>
            </div>
          </div>
          {life.statAllocationFinalized && <p className="mt-3 text-xs leading-5 text-[#75887e]">{config.character.allocationCompleteText}</p>}
          {(life.deathMarks?.length ?? 0) > 0 && (
            <div className="mt-3 rounded border border-[#54405f] bg-[#160f1c] px-3 py-2">
              <p className="text-xs text-[#9b86a7]">死亡命格</p>
              {life.deathMarks?.map((mark) => <p key={mark.id} className="mt-1 text-sm text-[#d6c0df]" title={mark.description}>「{mark.name}」</p>)}
            </div>
          )}
          {life.inheritedMemory && (
            <div className="mt-3 rounded border border-[#4a5036] bg-[#11170f] px-3 py-2">
              <p className="text-xs text-[#82968c]">前世记忆</p>
              <p className="mt-1 text-sm text-[#e0ce91]" title={life.inheritedMemory.description}>「{life.inheritedMemory.name}」</p>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#71847a]">
          {life ? config.character.earlySidebarText : "掷定此生命数后，从出身开始一步步完成入世。"}
        </p>
      )}
    </section>
  );
}
