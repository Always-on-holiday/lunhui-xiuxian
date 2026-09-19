"use client";

import type { PrologueLife } from "@/lib/prologue";

export type SidebarView = "character" | "assets" | "companions";

type SidebarNavigationProps = {
  value: SidebarView;
  life: PrologueLife | null;
  statAllocationReady: boolean;
  inventoryItemCount: number;
  playerCount: number;
  onChange(value: SidebarView): void;
};

export function SidebarNavigation({ value, life, statAllocationReady, inventoryItemCount, playerCount, onChange }: SidebarNavigationProps) {
  const tabClass = (tab: SidebarView) => `rounded-md px-3 py-2 text-sm transition ${value === tab ? "bg-[#19372d] text-[#f0dfae]" : "text-[#82968c] hover:bg-[#10251e] hover:text-[#c7d3cd]"}`;
  return (
    <nav className="order-2 grid shrink-0 grid-cols-3 rounded-lg border border-[#29443a] bg-[#08130f] p-1" aria-label="角色信息切换">
      <button type="button" aria-pressed={value === "character"} onClick={() => onChange("character")} className={tabClass("character")}>命格</button>
      <button
        type="button"
        aria-pressed={value === "assets"}
        disabled={!life || !statAllocationReady || Boolean(life.deathState)}
        onClick={() => onChange("assets")}
        className={`${tabClass("assets")} disabled:cursor-not-allowed disabled:opacity-35`}
      >
        行囊{life && statAllocationReady ? ` · ${inventoryItemCount}` : ""}
      </button>
      <button type="button" aria-pressed={value === "companions"} onClick={() => onChange("companions")} className={tabClass("companions")}>
        同伴 · {playerCount}
      </button>
    </nav>
  );
}
