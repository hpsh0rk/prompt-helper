export interface PromptHubItem {
  id: string;
  title: string | null;
  content: string;
  kind: "image" | "video" | "audio" | "text" | "code" | string;
  placeholders: string[];
  placeholderDefaults: Record<string, string>;
  tags: string[];
  models: string[];
  rating: number | null;
  favorited: boolean;
  coverSha: string | null;
  coverThumbSha: string | null;
  source: {
    type: string;
    url: string | null;
    author: string | null;
  };
  createdAt: string;
}

export interface PromptHubResponse {
  items: PromptHubItem[];
  nextCursor: string | null;
  total: number;
}

export interface Preferences {
  serverUrl?: string;
  apiKey?: string;
  defaultView?: "all" | "favorites" | "recent";
}

export interface CreatePromptInput {
  title?: string;
  content: string;
  kind?: "image" | "text" | "code" | "video" | "audio" | string;
  tags?: string[];
  model?: string;
  negative_prompt?: string;
  usage_notes?: string;
  placeholder_defaults?: Record<string, string>;
}

export type FilterMode = "all" | "favorites" | "recent" | "image" | "text" | "code" | "video" | "audio";

export const FILTER_OPTIONS: { id: FilterMode; label: string; icon: string }[] = [
  { id: "all", label: "全部提示词", icon: "list" },
  { id: "favorites", label: "⭐ 我的收藏", icon: "star" },
  { id: "recent", label: "🕒 最近使用", icon: "clock" },
  { id: "image", label: "生图 (Image)", icon: "image" },
  { id: "text", label: "文本 (Text)", icon: "document" },
  { id: "code", label: "代码 (Code)", icon: "code" },
  { id: "video", label: "视频 (Video)", icon: "video" },
  { id: "audio", label: "音频 (Audio)", icon: "music" },
];

export const KIND_LABELS: Record<string, { label: string; icon: string }> = {
  all: { label: "全部类型", icon: "list" },
  image: { label: "生图 (Image)", icon: "image" },
  text: { label: "文本 (Text)", icon: "document" },
  code: { label: "代码 (Code)", icon: "code" },
  video: { label: "视频 (Video)", icon: "video" },
  audio: { label: "音频 (Audio)", icon: "music" },
};

/**
 * 提取文本中的占位符（同时支持 PromptHub 原生 [变量] 与经典 {{变量}}）
 */
export function extractAllPlaceholders(text: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  // 1. PromptHub 规范：[占位符]
  const bracketRe = /\[([^\]\r\n]{1,60})\]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(text)) !== null) {
    const key = m[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  // 2. 兼容经典语法：{{变量}}
  const doubleBraceRe = /\{\{([^}\r\n]{1,60})\}\}/g;
  while ((m = doubleBraceRe.exec(text)) !== null) {
    const key = m[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  return result;
}

/**
 * 将填入的值替换回正文模板
 */
export function substitutePlaceholders(template: string, values: Record<string, string>): string {
  let rendered = template;
  for (const [k, v] of Object.entries(values)) {
    const val = v ?? "";
    // 替换 [k]
    rendered = rendered.split(`[${k}]`).join(val);
    // 替换 {{k}}
    rendered = rendered.split(`{{${k}}}`).join(val);
  }
  return rendered;
}
