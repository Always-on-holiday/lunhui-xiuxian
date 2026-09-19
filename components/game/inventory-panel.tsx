"use client";

import type { ReactNode } from "react";
import { MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { itemTags, type ActionSelection } from "@/lib/client/action-selection";
import type { InventoryItem, PrologueConfig, PrologueLife } from "@/lib/prologue";

type InventoryPanelProps = {
  visible: boolean;
  life: PrologueLife | null;
  config: PrologueConfig;
  activeActionTarget: string | null;
  itemActionSelection: (item: InventoryItem) => ActionSelection;
  renderActionMenu: (selection: ActionSelection) => ReactNode;
  onToggleActionTarget: (key: string) => void;
  onEatItem: (selection: ActionSelection) => void;
  onPrepareEventItem: (itemId: string) => void;
  onPrepareTrialItem: (itemId: string) => void;
};

export function InventoryPanel({
  visible,
  life,
  config,
  activeActionTarget,
  itemActionSelection,
  renderActionMenu,
  onToggleActionTarget,
  onEatItem,
  onPrepareEventItem,
  onPrepareTrialItem,
}: InventoryPanelProps) {
  if (!visible || !life) return null;

  const inventory = (life.inventory ?? []).filter((item) => item.quantity > 0);

  return (
    <section className="order-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#29443a] p-4 ink-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-[#f0dfae]">{config.character.assetsTitle}</h2>
        <span className="rounded-full border border-[#5f5335] px-3 py-1 font-mono text-sm text-[#e3c873]">
          {config.character.spiritStoneLabel} {life.spiritStones ?? 0}
        </span>
      </div>
      <Tabs defaultValue="inventory" className="mt-3 min-h-0 flex-1">
        <TabsList className="grid w-full grid-cols-3 bg-[#08130f]">
          <TabsTrigger value="inventory">{config.character.inventoryTab}</TabsTrigger>
          <TabsTrigger value="cultivation">{config.character.cultivationTab}</TabsTrigger>
          <TabsTrigger value="technique">{config.character.techniqueTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="mt-3 min-h-0 overflow-y-auto pr-1 [scrollbar-color:#3b584a_#08130f] [scrollbar-width:thin]">
          {inventory.length > 0 ? (
            <div className="space-y-3">
              {inventory.map((item) => {
                const actionSelection = itemActionSelection(item);
                const eventPreparing = Boolean(
                  life.adventure?.currentEventId
                    && !life.adventure.lastResolution
                    && !life.adventure.stageComplete,
                );
                const selected = eventPreparing
                  ? life.adventure?.selectedItemIds.includes(item.id) ?? false
                  : life.selectedTrialItemIds?.includes(item.id) ?? false;
                const mayPrepare = eventPreparing
                  || Boolean(!life.adventure && life.training && (!life.battle || life.battle.outcome === "defeat"));

                return (
                  <div key={item.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        aria-expanded={activeActionTarget === actionSelection.key}
                        onClick={() => onToggleActionTarget(actionSelection.key)}
                      >
                        <p className="text-sm text-[#e6d8ad]">{item.name} × {item.quantity}</p>
                        <p className="mt-1 text-xs text-[#75887e]">{item.category} · {item.consumable ? "消耗品" : "持有物"}</p>
                        <p className="mt-2 text-sm leading-6 text-[#98a69f]">{item.description}</p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-[#b69a63]">
                          <MousePointer2 className="h-3 w-3" />点击选择行为
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col gap-2">
                        {itemTags(item).some((tag) => ["food", "herb", "toxic"].includes(tag)) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEatItem(actionSelection)}
                            className="border-[#625539] bg-[#17150d] text-[#dfc77f] hover:bg-[#292313] hover:text-[#f2dfa5]"
                          >
                            食用
                          </Button>
                        )}
                        {mayPrepare && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => eventPreparing ? onPrepareEventItem(item.id) : onPrepareTrialItem(item.id)}
                            className={selected
                              ? "border-[#b99a56] bg-[#3b321c] text-[#f0d78f] hover:bg-[#4a3e22]"
                              : "border-[#3b584a] bg-transparent text-[#aebdb5] hover:bg-[#17352c] hover:text-white"}
                          >
                            {selected ? config.character.selectedItem : config.character.selectItem}
                          </Button>
                        )}
                      </div>
                    </div>
                    {renderActionMenu(actionSelection)}
                  </div>
                );
              })}
              <p className="text-xs leading-5 text-[#70837a]">
                {life.adventure
                  ? "可为当前事件备好任意数量的道具；结算时仅消耗真正生效的消耗品。"
                  : config.character.itemUseHint}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#71847a]">{config.character.inventoryEmpty}</p>
          )}
        </TabsContent>
        <TabsContent value="cultivation" className="mt-3 min-h-0 space-y-3 overflow-y-auto pr-1 [scrollbar-color:#3b584a_#08130f] [scrollbar-width:thin]">
          {(life.cultivationArts ?? []).length > 0 ? (life.cultivationArts ?? []).map((ability) => (
            <div key={ability.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#e6d8ad]">{ability.name}</p>
                <span className="text-xs text-[#b69a63]">{ability.grade}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#98a69f]">{ability.description}</p>
            </div>
          )) : <p className="text-sm text-[#71847a]">{config.character.cultivationEmpty}</p>}
        </TabsContent>
        <TabsContent value="technique" className="mt-3 min-h-0 space-y-3 overflow-y-auto pr-1 [scrollbar-color:#3b584a_#08130f] [scrollbar-width:thin]">
          {(life.techniques ?? []).length > 0 ? (life.techniques ?? []).map((ability) => (
            <div key={ability.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#e6d8ad]">{ability.name}</p>
                <span className="text-xs text-[#b69a63]">{ability.grade}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#98a69f]">{ability.description}</p>
            </div>
          )) : <p className="text-sm text-[#71847a]">{config.character.techniqueEmpty}</p>}
        </TabsContent>
      </Tabs>
    </section>
  );
}
