"use client";

import { Copy, Globe2, Hourglass, LogOut, Shield, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Room } from "@/lib/client/game-session";
import type { UiContent } from "@/lib/client/ui-content";
import { formatWorldDate, formatYearsAndDays } from "@/lib/longevity";

type WorldHeaderProps = {
  content: UiContent;
  room: Room;
  daysPerYear: number;
  remainingLifeDays: number | null;
  remainingLifePercent: number;
  lifeExpired: boolean;
  copied: boolean;
  onCopyInvite(): void;
  onLeave(): void;
};

export function WorldHeader({
  content,
  room,
  daysPerYear,
  remainingLifeDays,
  remainingLifePercent,
  lifeExpired,
  copied,
  onCopyInvite,
  onLeave,
}: WorldHeaderProps) {
  return (
    <header className="mb-3 flex flex-wrap items-center gap-3 border-b border-[#29443a] pb-3">
      <div className="flex items-center gap-3">
        <div className="seal grid h-9 w-9 place-items-center font-bold">{content.brand.seal}</div>
        <div>
          <p className="tracking-[0.2em] text-[#f0dfae]">{content.brand.name}</p>
          <p className="hidden text-xs text-[#82968c] xl:block">{content.brand.subtitle}</p>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <div className="min-w-[230px] rounded-md border border-[#365146] bg-[#0a1713]/90 px-3 py-2">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-[#81968b]">
              {content.world.calendarLabel}
              <strong className="ml-2 font-normal text-[#e8eee8]">{formatWorldDate(room.worldDay, daysPerYear)}</strong>
            </span>
            <span className={lifeExpired ? "flex items-center gap-1 text-[#e99580]" : "flex items-center gap-1 text-[#d4bd78]"}>
              <Hourglass className="h-3.5 w-3.5" />
              {remainingLifeDays === null
                ? "阳寿未定"
                : remainingLifeDays <= 0
                  ? "阳寿已尽"
                  : `余 ${formatYearsAndDays(remainingLifeDays, daysPerYear)}`}
            </span>
          </div>
          {remainingLifeDays !== null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#2a2118]" title={`剩余阳寿 ${remainingLifeDays.toLocaleString("zh-CN")} 天`}>
              <div
                className={`h-full rounded-full ${lifeExpired ? "bg-[#b95f55]" : "bg-[#c3a45f]"}`}
                style={{ width: `${remainingLifePercent}%` }}
              />
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCopyInvite}
          title={`${content.world.roomLabel} ${room.code}`}
          className="h-9 border border-[#304a40] px-3 text-[#aabbb2] hover:bg-[#17352c] hover:text-white"
        >
          <Globe2 className="h-3.5 w-3.5" />
          <span className="font-mono tracking-[0.18em] text-[#e7d49c]">{room.code}</span>
          {copied
            ? <span className="text-[11px] text-[#86baa3]">{content.world.copiedShort}</span>
            : <Copy className="h-3.5 w-3.5" />}
          <span className="sr-only">{content.world.inviteShort}</span>
        </Button>
        <span
          title={content.world.pvpLabel}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs ${room.pvpEnabled ? "border-[#69443e] bg-[#241512] text-[#d99585]" : "border-[#315046] bg-[#0c1b16] text-[#84b7a0]"}`}
        >
          {room.pvpEnabled ? <Swords className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
          PVP {room.pvpEnabled ? content.world.pvpEnabled : content.world.pvpDisabled}
        </span>
        <Button size="icon-sm" variant="outline" onClick={onLeave} title={content.world.leaveButton} aria-label={content.world.leaveButton} className="border-[#385248] bg-transparent text-[#bbc8c0] hover:bg-[#14241f] hover:text-white">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
