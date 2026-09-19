import defaultContent from "@/public/游戏内容/界面文字.json";

export type UiContent = typeof defaultContent;

export function mergeUiContent(value: unknown): UiContent {
  if (!value || typeof value !== "object") return defaultContent;
  const candidate = value as Partial<UiContent>;
  return {
    ...defaultContent,
    ...candidate,
    meta: { ...defaultContent.meta, ...candidate.meta },
    brand: { ...defaultContent.brand, ...candidate.brand },
    landing: {
      ...defaultContent.landing,
      ...candidate.landing,
      highlights: Array.isArray(candidate.landing?.highlights)
        ? candidate.landing.highlights
        : defaultContent.landing.highlights,
    },
    world: {
      ...defaultContent.world,
      ...candidate.world,
      storyParagraphs: Array.isArray(candidate.world?.storyParagraphs)
        ? candidate.world.storyParagraphs
        : defaultContent.world.storyParagraphs,
    },
  };
}

export { defaultContent };
