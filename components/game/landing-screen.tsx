"use client";

import type { FormEvent } from "react";
import { Globe2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UiContent } from "@/lib/client/ui-content";

type LandingScreenProps = {
  content: UiContent;
  name: string;
  roomCode: string;
  pvpEnabled: boolean;
  busy: boolean;
  error: string;
  onNameChange(value: string): void;
  onRoomCodeChange(value: string): void;
  onPvpChange(value: boolean): void;
  onCreate(event: FormEvent<HTMLFormElement>): void;
  onJoin(event: FormEvent<HTMLFormElement>): void;
};

export function LandingScreen({
  content,
  name,
  roomCode,
  pvpEnabled,
  busy,
  error,
  onNameChange,
  onRoomCodeChange,
  onPvpChange,
  onCreate,
  onJoin,
}: LandingScreenProps) {
  return (
    <main className="world-grid min-h-screen px-4 py-6 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-[#29443a] pb-4">
          <div className="flex items-center gap-3">
            <div className="seal grid h-10 w-10 place-items-center text-lg font-bold">{content.brand.seal}</div>
            <div>
              <p className="text-lg tracking-[0.22em] text-[#f0dfae]">{content.brand.name}</p>
              <p className="text-sm text-[#82968c]">{content.brand.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#8aa296]">
            <span className="slow-pulse h-2 w-2 rounded-full bg-[#71b395]" />
            {content.brand.serviceStatus}
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-105px)] items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <p className="mb-4 flex items-center gap-2 text-sm tracking-[0.24em] text-[#7fa08f]">
              <Globe2 className="h-4 w-4" />
              {content.landing.eyebrow}
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight text-[#f4e8c5] sm:text-6xl">
              {content.landing.titleLead}
              <span className="block text-[#d6b66d]">{content.landing.titleAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#9fb0a7]">{content.landing.description}</p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {content.landing.highlights.map(({ value, label }) => (
                <div key={value} className="border-l border-[#496355] pl-4">
                  <p className="text-xl text-[#e7d49c]">{value}</p>
                  <p className="mt-1 text-sm text-[#74877e]">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ink-panel rounded-lg border border-[#355046] p-5 sm:p-7">
            <Tabs defaultValue={roomCode ? "join" : "create"}>
              <TabsList className="grid w-full grid-cols-2 bg-[#08130f]">
                <TabsTrigger value="create">{content.landing.createTab}</TabsTrigger>
                <TabsTrigger value="join">{content.landing.joinTab}</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-6">
                <form onSubmit={onCreate} className="space-y-5">
                  <div>
                    <label htmlFor="create-name" className="mb-2 block text-sm text-[#9caf9f]">{content.landing.nameLabel}</label>
                    <Input
                      id="create-name"
                      value={name}
                      onChange={(event) => onNameChange(event.target.value)}
                      placeholder={content.landing.createNamePlaceholder}
                      minLength={2}
                      maxLength={16}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] text-base"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-[#2d483d] bg-[#091511] p-4">
                    <div>
                      <label htmlFor="pvp-switch" className="text-[#e2e8df]">{content.landing.pvpLabel}</label>
                      <p className="mt-1 text-sm text-[#74877e]">{content.landing.pvpDescription}</p>
                    </div>
                    <Switch id="pvp-switch" checked={pvpEnabled} onCheckedChange={onPvpChange} />
                  </div>
                  <Button type="submit" disabled={busy} className="h-12 w-full bg-[#d6b66d] text-base text-[#102019] hover:bg-[#e7cc8b]">
                    <Sparkles className="h-4 w-4" />
                    {busy ? content.landing.createBusy : content.landing.createButton}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                <form onSubmit={onJoin} className="space-y-5">
                  <div>
                    <label htmlFor="join-name" className="mb-2 block text-sm text-[#9caf9f]">{content.landing.nameLabel}</label>
                    <Input
                      id="join-name"
                      value={name}
                      onChange={(event) => onNameChange(event.target.value)}
                      placeholder={content.landing.joinNamePlaceholder}
                      minLength={2}
                      maxLength={16}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="room-code" className="mb-2 block text-sm text-[#9caf9f]">{content.landing.roomCodeLabel}</label>
                    <Input
                      id="room-code"
                      value={roomCode}
                      onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))}
                      placeholder={content.landing.roomCodePlaceholder}
                      minLength={6}
                      maxLength={6}
                      required
                      className="h-12 border-[#395348] bg-[#07100e] font-mono text-lg tracking-[0.22em]"
                    />
                  </div>
                  <Button type="submit" disabled={busy} className="h-12 w-full bg-[#d6b66d] text-base text-[#102019] hover:bg-[#e7cc8b]">
                    <Users className="h-4 w-4" />
                    {busy ? content.landing.joinBusy : content.landing.joinButton}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && <p role="alert" className="mt-4 rounded-md border border-[#743f36] bg-[#351b18] px-4 py-3 text-sm text-[#f0a08d]">{error}</p>}
            <p className="mt-5 text-center text-sm leading-6 text-[#6f8278]">{content.landing.privacyNotice}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
