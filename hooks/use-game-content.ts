"use client";

import { useEffect, useState } from "react";
import { isEventEngineConfig, isEventLibraryConfig, type EventEngineConfig, type EventLibraryConfig } from "@/lib/events";
import { isFreeActionConfig, type FreeActionConfig } from "@/lib/free-actions";
import { isPrologueConfig, type PrologueConfig } from "@/lib/prologue";
import { isReincarnationConfig, type ReincarnationConfig } from "@/lib/reincarnation";
import { defaultContent, mergeUiContent, type UiContent } from "@/lib/client/ui-content";
import defaultPrologueConfig from "@/public/游戏内容/序章规则.json";
import defaultEventConfig from "@/public/游戏内容/随机事件/01-新手村.json";
import defaultEventEngineConfig from "@/public/游戏内容/随机事件/阶段列表.json";
import defaultReincarnationConfig from "@/public/游戏内容/轮回规则.json";
import defaultFreeActionConfig from "@/public/游戏内容/自由行动/自由行动规则.json";

async function fetchJson(path: string, errorMessage: string) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(errorMessage);
  return response.json() as Promise<unknown>;
}

export function useGameContent() {
  const [content, setContent] = useState<UiContent>(defaultContent);
  const [prologueConfig, setPrologueConfig] = useState<PrologueConfig>(defaultPrologueConfig as PrologueConfig);
  const [eventConfig, setEventConfig] = useState<EventLibraryConfig>(defaultEventConfig as unknown as EventLibraryConfig);
  const [eventEngineConfig, setEventEngineConfig] = useState<EventEngineConfig>(defaultEventEngineConfig as unknown as EventEngineConfig);
  const [reincarnationConfig, setReincarnationConfig] = useState<ReincarnationConfig>(defaultReincarnationConfig as ReincarnationConfig);
  const [freeActionConfig, setFreeActionConfig] = useState<FreeActionConfig>(defaultFreeActionConfig as unknown as FreeActionConfig);

  useEffect(() => {
    void fetchJson("/游戏内容/界面文字.json", "内容配置读取失败")
      .then((value) => {
        const nextContent = mergeUiContent(value);
        setContent(nextContent);
        document.title = nextContent.meta.title;
        const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (description) description.content = nextContent.meta.description;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetchJson("/游戏内容/轮回规则.json", "轮回规则读取失败")
      .then((value) => {
        if (isReincarnationConfig(value)) setReincarnationConfig(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetchJson("/游戏内容/自由行动/自由行动规则.json", "自由行动规则读取失败")
      .then((value) => {
        if (isFreeActionConfig(value)) setFreeActionConfig(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetchJson("/游戏内容/序章规则.json", "序章规则读取失败")
      .then((value) => {
        if (isPrologueConfig(value)) setPrologueConfig(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void Promise.all([
      fetchJson("/游戏内容/随机事件/01-新手村.json", "新手村事件读取失败"),
      fetchJson("/游戏内容/随机事件/阶段列表.json", "事件引擎规则读取失败"),
    ]).then(([library, engine]) => {
      if (isEventLibraryConfig(library)) setEventConfig(library);
      if (isEventEngineConfig(engine)) setEventEngineConfig(engine);
    }).catch(() => undefined);
  }, []);

  return {
    content,
    prologueConfig,
    eventConfig,
    eventEngineConfig,
    reincarnationConfig,
    freeActionConfig,
  };
}
