"use client";

import type { ReactNode } from "react";
import { Copy, Ghost, MousePointer2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionSelection } from "@/lib/client/action-selection";
import type { Player, Room, Session } from "@/lib/client/game-session";
import type { UiContent } from "@/lib/client/ui-content";
import type { PrologueConfig, PrologueLife } from "@/lib/prologue";
import type { ReincarnationConfig, RevivalMethodConfig } from "@/lib/reincarnation";

type CompanionsPanelProps = {
  visible: boolean;
  room: Room;
  session: Session;
  content: UiContent;
  life: PrologueLife | null;
  ownPlayer?: Player;
  statAllocationReady: boolean;
  lifeExpired: boolean;
  activeActionTarget: string | null;
  error: string | null;
  lifeActionBusy: boolean;
  reincarnationConfig: ReincarnationConfig;
  prologueConfig: PrologueConfig;
  playerActionSelection: (player: Player) => ActionSelection;
  renderActionMenu: (selection: ActionSelection) => ReactNode;
  onToggleActionTarget: (key: string) => void;
  canPayRevival: (method: RevivalMethodConfig) => boolean;
  onRevivePlayer: (playerId: string, method: RevivalMethodConfig) => void;
  onCopyInvite: () => void;
};

export function CompanionsPanel({
  visible,
  room,
  session,
  content,
  life,
  ownPlayer,
  statAllocationReady,
  lifeExpired,
  activeActionTarget,
  error,
  lifeActionBusy,
  reincarnationConfig,
  prologueConfig,
  playerActionSelection,
  renderActionMenu,
  onToggleActionTarget,
  canPayRevival,
  onRevivePlayer,
  onCopyInvite,
}: CompanionsPanelProps) {
  return (
    <section className={`${visible ? "order-3 min-h-0 flex-1 overflow-y-auto" : "hidden"} ink-panel rounded-lg border border-[#29443a] p-4 [scrollbar-color:#3b584a_#08130f] [scrollbar-width:thin]`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base text-[#f0dfae]">
          <Users className="h-4 w-4" />
          {content.world.playersTitle}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#82968c]">{room.players.length} / 4</span>
          <Button onClick={onCopyInvite} size="icon-xs" variant="ghost" title={content.world.copyInvite} aria-label={content.world.copyInvite} className="text-[#b9a368] hover:bg-[#17352c] hover:text-white">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {room.players.map((player) => {
          const isCurrentPlayer = player.id === session.playerId;
          const actionSelection = playerActionSelection(player);
          const canUseFreeActions = !isCurrentPlayer
            && player.lifeStatus === "alive"
            && ownPlayer?.lifeStatus === "alive"
            && Boolean(life && statAllocationReady && !life.deathState && !lifeExpired);

          return (
            <div key={player.id} className={`rounded-md border px-3 py-2 ${player.lifeStatus === "soul" ? "border-[#594565] bg-[#150f1b]" : "border-[#284138] bg-[#091511]"}`}>
              <button
                type="button"
                disabled={!canUseFreeActions}
                aria-expanded={canUseFreeActions && activeActionTarget === actionSelection.key}
                onClick={() => onToggleActionTarget(actionSelection.key)}
                className="flex w-full items-center gap-3 text-left disabled:cursor-default"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#e7ebe4]">{player.name}</p>
                  <p className="text-xs text-[#74877e]">
                    {player.lifeStatus === "soul"
                      ? `残魂 · 魂力 ${player.soulPower}`
                      : player.lifeStatus === "rebirth"
                        ? "等待轮回"
                        : `${player.realm ?? (player.isHost ? content.world.hostRole : content.world.playerRole)} · ${player.level}级`}
                  </p>
                </div>
                {player.lifeStatus === "soul" && <Ghost className="h-4 w-4 text-[#a987ba]" />}
                {isCurrentPlayer
                  ? <span className="text-xs text-[#d6b66d]">{content.world.currentPlayer}</span>
                  : canUseFreeActions && <span className="flex items-center gap-1 text-xs text-[#b69a63]"><MousePointer2 className="h-3 w-3" />行为</span>}
              </button>
              {canUseFreeActions && renderActionMenu(actionSelection)}
              {player.lifeStatus === "soul" && ownPlayer?.lifeStatus === "alive" && player.id !== session.playerId && life && !life.deathState && (
                <details className="mt-2 border-t border-[#493852] pt-2">
                  <summary className="cursor-pointer text-xs text-[#c2a8cf]">{reincarnationConfig.revival.title}</summary>
                  <p className="mt-2 text-xs leading-5 text-[#7f7485]">{reincarnationConfig.revival.summary}</p>
                  <div className="mt-2 grid gap-2">
                    {reincarnationConfig.revival.methods.filter((method) => !method.selfOnly).map((method) => {
                      const cost = method.actorCost ?? {};
                      const costText = cost.spiritStones
                        ? `${cost.spiritStones} 灵石`
                        : cost.spirit
                          ? `${cost.spirit} 灵力`
                          : cost.itemId
                            ? `道具 ×${cost.itemQuantity ?? 1}`
                            : "无消耗";
                      return (
                        <Button
                          key={method.id}
                          size="sm"
                          variant="outline"
                          disabled={lifeActionBusy || !canPayRevival(method)}
                          onClick={() => onRevivePlayer(player.id, method)}
                          className="justify-between border-[#594565] bg-transparent text-[#ccb8d5] hover:bg-[#24182b] hover:text-white"
                          title={method.description}
                        >
                          <span>{method.title}</span><span className="text-[11px] opacity-70">{costText}</span>
                        </Button>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-[#e99580]">{error}</p>}
      {life && statAllocationReady && (
        <details className="mt-4 rounded border border-[#29443a] bg-[#08130f] px-3 py-2.5">
          <summary className="cursor-pointer text-sm text-[#b9aa7d]">世界与复活规则</summary>
          <div className="mt-3 border-t border-[#29443a] pt-3">
            <p className="text-sm text-[#d9c98f]">{reincarnationConfig.death.title}</p>
            <p className="mt-2 text-xs leading-5 text-[#7f9288]">{reincarnationConfig.death.summary}</p>
          </div>
          <div className="mt-4">
            <p className="text-sm text-[#d9c98f]">{prologueConfig.worldRules.multiplayerTitle}</p>
            <div className="mt-2 space-y-2">
              {prologueConfig.worldRules.raids.map((raid) => (
                <div key={raid.id} className="rounded border border-[#2b4439] bg-[#08130f] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[#dce4dc]">{raid.name}</p>
                    <span className="text-xs text-[#b99a60]">{raid.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#768a80]">{raid.description}</p>
                  <p className="mt-2 text-xs text-[#60746a]">
                    {raid.minimumPlayers}–{raid.maximumPlayers} 人 · {raid.unlockRealm}解锁
                  </p>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
