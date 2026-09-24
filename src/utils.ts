import { Cache, Icon, LocalStorage, getPreferenceValues } from "@raycast/api";
import nodeFetch from "node-fetch";
import { CreatePromptInput, FilterMode, Preferences, PromptHubItem } from "./types";

function getFetch() {
  if (typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch;
  }
  return nodeFetch as unknown as typeof globalThis.fetch;
}

export const appCache = new Cache();

export const CACHE_KEYS = {
  PROMPTS: "prompt_helper_prompts_cache",
  PROMPTS_UPDATED_AT: "prompt_helper_prompts_updated_at",
  RECENT: "prompt_helper_recent_cache",
  DEFAULT_VIEW: "prompt_helper_default_view_cache",
};

export const CACHE_TTL_MS = 60 * 1000; // 60 秒新鲜度，避免每次打开都重新发起网络请求

export function isCacheFresh(ttlMs: number = CACHE_TTL_MS): boolean {
  try {
    const timeStr = appCache.get(CACHE_KEYS.PROMPTS_UPDATED_AT);
    if (!timeStr) return false;
    const time = Number(timeStr);
    return Date.now() - time < ttlMs;
  } catch {
    return false;
  }
}

export function getSyncCachedPrompts(): PromptHubItem[] {
  try {
    const raw = appCache.get(CACHE_KEYS.PROMPTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PromptHubItem[]) : [];
  } catch {
    return [];
  }
}

export function saveSyncCachedPrompts(items: PromptHubItem[]): void {
  try {
    const trimmed = items.slice(0, 50);
    appCache.set(CACHE_KEYS.PROMPTS, JSON.stringify(trimmed));
    appCache.set(CACHE_KEYS.PROMPTS_UPDATED_AT, String(Date.now()));
  } catch (err) {
    console.error("[PromptHelper] failed to save sync cached prompts:", err);
  }
}

export function getSyncCachedRecent(): PromptHubItem[] {
  try {
    const raw = appCache.get(CACHE_KEYS.RECENT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PromptHubItem[]) : [];
  } catch {
    return [];
  }
}

export function getSyncCachedDefaultView(): FilterMode | null {
  try {
    const saved = appCache.get(CACHE_KEYS.DEFAULT_VIEW);
    if (saved === "all" || saved === "favorites" || saved === "recent") {
      return saved as FilterMode;
    }
    return null;
  } catch {
    return null;
  }
}

export const RECENT_PROMPTS_KEY = "prompt_helper_recent_prompts";
export const PROMPTS_CACHE_KEY = "prompt_helper_cached_prompts";
const MAX_RECENT_PROMPTS = 30;

export async function getCachedPrompts(): Promise<PromptHubItem[]> {
  const syncItems = getSyncCachedPrompts();
  if (syncItems.length > 0) return syncItems;

  try {
    const raw = await LocalStorage.getItem<string>(PROMPTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      saveSyncCachedPrompts(parsed as PromptHubItem[]);
      return parsed as PromptHubItem[];
    }
    return [];
  } catch (err) {
    console.error("[PromptHelper] failed to get cached prompts:", err);
    return [];
  }
}

export async function saveCachedPrompts(items: PromptHubItem[]): Promise<void> {
  try {
    saveSyncCachedPrompts(items);
    const trimmed = items.slice(0, 50);
    await LocalStorage.setItem(PROMPTS_CACHE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("[PromptHelper] failed to save cached prompts:", err);
  }
}

export async function getRecentPrompts(): Promise<PromptHubItem[]> {
  const syncRecent = getSyncCachedRecent();
  if (syncRecent.length > 0) return syncRecent;

  try {
    const raw = await LocalStorage.getItem<string>(RECENT_PROMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      appCache.set(CACHE_KEYS.RECENT, JSON.stringify(parsed));
      return parsed as PromptHubItem[];
    }
    return [];
  } catch (err) {
    console.error("[PromptHelper] failed to get recent prompts:", err);
    return [];
  }
}

export async function recordPromptUsage(item: PromptHubItem): Promise<PromptHubItem[]> {
  try {
    const current = await getRecentPrompts();
    const filtered = current.filter((p) => p.id !== item.id);
    const updated = [item, ...filtered].slice(0, MAX_RECENT_PROMPTS);
    appCache.set(CACHE_KEYS.RECENT, JSON.stringify(updated));
    await LocalStorage.setItem(RECENT_PROMPTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("[PromptHelper] failed to record prompt usage:", err);
    return [];
  }
}

export async function clearRecentPrompts(): Promise<void> {
  try {
    appCache.remove(CACHE_KEYS.RECENT);
    await LocalStorage.removeItem(RECENT_PROMPTS_KEY);
  } catch (err) {
    console.error("[PromptHelper] failed to clear recent prompts:", err);
  }
}

export async function removeRecentPrompt(promptId: string): Promise<PromptHubItem[]> {
  try {
    const current = await getRecentPrompts();
    const updated = current.filter((p) => p.id !== promptId);
    appCache.set(CACHE_KEYS.RECENT, JSON.stringify(updated));
    await LocalStorage.setItem(RECENT_PROMPTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("[PromptHelper] failed to remove recent prompt:", err);
    return [];
  }
}

export const DEFAULT_VIEW_KEY = "prompt_helper_default_view";

export async function getSavedDefaultView(): Promise<FilterMode | null> {
  const syncView = getSyncCachedDefaultView();
  if (syncView) return syncView;

  try {
    const saved = await LocalStorage.getItem<string>(DEFAULT_VIEW_KEY);
    if (saved === "all" || saved === "favorites" || saved === "recent") {
      appCache.set(CACHE_KEYS.DEFAULT_VIEW, saved);
      return saved as FilterMode;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveDefaultView(view: FilterMode): Promise<void> {
  try {
    appCache.set(CACHE_KEYS.DEFAULT_VIEW, view);
    await LocalStorage.setItem(DEFAULT_VIEW_KEY, view);
  } catch (err) {
    console.error("[PromptHelper] failed to save default view:", err);
  }
}

export async function updateRecentPromptFavorite(promptId: string, favorited: boolean): Promise<PromptHubItem[]> {
  try {
    const current = await getRecentPrompts();
    let hasChanged = false;
    const updated = current.map((p) => {
      if (p.id === promptId && p.favorited !== favorited) {
        hasChanged = true;
        return { ...p, favorited };
      }
      return p;
    });
    if (hasChanged) {
      appCache.set(CACHE_KEYS.RECENT, JSON.stringify(updated));
      await LocalStorage.setItem(RECENT_PROMPTS_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return [];
  }
}

export async function toggleFavoritePrompt(
  serverUrl: string,
  apiKey: string | undefined,
  promptId: string,
  currentFavorited?: boolean,
): Promise<{ favorited: boolean }> {
  const f = getFetch();
  if (apiKey) {
    if (currentFavorited) {
      const url = `${serverUrl}/api/v1/favorites?prompt_id=${encodeURIComponent(promptId)}`;
      const res = await f(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
      }
      const data = (await res.json()) as { favorited: boolean };
      return { favorited: Boolean(data.favorited) };
    } else {
      const url = `${serverUrl}/api/v1/favorites`;
      const res = await f(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ prompt_id: promptId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
      }
      const data = (await res.json()) as { favorited: boolean };
      return { favorited: Boolean(data.favorited) };
    }
  } else {
    const url = `${serverUrl}/library-items/favorite`;
    const res = await f(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt_id: promptId }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
    }
    const data = (await res.json()) as { favorited: boolean };
    return { favorited: Boolean(data.favorited) };
  }
}

export async function createPromptApi(
  serverUrl: string,
  apiKey: string | undefined,
  input: CreatePromptInput,
): Promise<{ id: string; versionNo?: number }> {
  const f = getFetch();
  const endpoint = apiKey ? `${serverUrl}/api/v1/prompts` : `${serverUrl}/library-items`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await f(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  const data = (await res.json()) as { id: string; versionNo?: number };
  return data;
}

export async function deletePromptApi(
  serverUrl: string,
  apiKey: string | undefined,
  promptId: string,
): Promise<{ deleted: boolean }> {
  const f = getFetch();
  const endpoint = apiKey
    ? `${serverUrl}/api/v1/prompts/${encodeURIComponent(promptId)}`
    : `${serverUrl}/library-items?id=${encodeURIComponent(promptId)}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await f(endpoint, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  const data = (await res.json()) as { deleted: boolean };
  return data;
}

export function getApiConfig() {
  const prefs = getPreferenceValues<Preferences>();
  let serverUrl = (prefs.serverUrl || "http://127.0.0.1:3210").trim();
  if (serverUrl.endsWith("/")) {
    serverUrl = serverUrl.slice(0, -1);
  }
  const apiKey = (prefs.apiKey || "").trim();
  const defaultView = prefs.defaultView || "all";

  // 若提供了 PAT，走标准对外 API /api/v1/prompts；若未提供，本地回退到免鉴权 /library-items 端点
  const endpoint = apiKey ? `${serverUrl}/api/v1/prompts` : `${serverUrl}/library-items`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return { serverUrl, apiKey, endpoint, headers, defaultView };
}

export function getKindIcon(kind: string): Icon {
  switch (kind) {
    case "image":
      return Icon.Image;
    case "text":
      return Icon.Document;
    case "code":
      return Icon.Code;
    case "video":
      return Icon.Video;
    case "audio":
      return Icon.Music;
    default:
      return Icon.Text;
  }
}

export function getImageUrl(serverUrl: string, sha: string | null | undefined): string | null {
  if (!sha) return null;
  return `${serverUrl}/b/${sha}`;
}

export function buildDetailMarkdown(item: PromptHubItem, serverUrl: string): string {
  const parts: string[] = [];

  // 1. 若存在效果图或样图封面，在顶部渲染预览图
  const imageSha = item.coverThumbSha || item.coverSha;
  if (imageSha) {
    parts.push(`![Preview](${serverUrl}/b/${imageSha})\n`);
  }

  // 2. 标题与说明
  if (item.title) {
    parts.push(`### ${item.title}\n`);
  }

  // 3. 正文内容
  parts.push("```text\n" + item.content + "\n```");

  // 4. 占位符提示
  if (item.placeholders && item.placeholders.length > 0) {
    parts.push(`\n**占位符 (${item.placeholders.length})**：`);
    const defaultLines = item.placeholders.map((ph) => {
      const defVal = item.placeholderDefaults?.[ph];
      return defVal ? `- \`[${ph}]\` → *${defVal}*` : `- \`[${ph}]\``;
    });
    parts.push(defaultLines.join("\n"));
  }

  return parts.join("\n\n");
}
