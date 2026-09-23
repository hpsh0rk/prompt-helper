import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Keyboard,
  List,
  Toast,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import fetch, {
  Headers as NodeFetchHeaders,
  Request as NodeFetchRequest,
  Response as NodeFetchResponse,
} from "node-fetch";
import { FillPlaceholdersForm } from "./components/FillPlaceholdersForm";
import { FILTER_OPTIONS, FilterMode, KIND_LABELS, PromptHubItem, PromptHubResponse } from "./types";
import {
  buildDetailMarkdown,
  clearRecentPrompts,
  getApiConfig,
  getKindIcon,
  getRecentPrompts,
  recordPromptUsage,
  toggleFavoritePrompt,
  updateRecentPromptFavorite,
} from "./utils";

// 兼容老版本 Node / Raycast 环境缺失的 Web API 全局变量
const globalScope = globalThis as Record<string, unknown>;
if (typeof globalScope.fetch === "undefined") {
  globalScope.fetch = fetch;
}
if (typeof globalScope.Request === "undefined") {
  globalScope.Request = NodeFetchRequest;
}
if (typeof globalScope.Response === "undefined") {
  globalScope.Response = NodeFetchResponse;
}
if (typeof globalScope.Headers === "undefined") {
  globalScope.Headers = NodeFetchHeaders;
}

function getFilterIcon(id: FilterMode): Icon {
  switch (id) {
    case "all":
      return Icon.List;
    case "favorites":
      return Icon.Star;
    case "recent":
      return Icon.Clock;
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
  }
}

function matchPrompt(prompt: PromptHubItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (prompt.title && prompt.title.toLowerCase().includes(q)) return true;
  if (prompt.content && prompt.content.toLowerCase().includes(q)) return true;
  if (prompt.tags && prompt.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (prompt.models && prompt.models.some((m) => m.toLowerCase().includes(q))) return true;
  if (prompt.placeholders && prompt.placeholders.some((p) => p.toLowerCase().includes(q))) return true;
  return false;
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [fallbackHost, setFallbackHost] = useState<string | null>(null);

  const baseConfig = useMemo(() => getApiConfig(), []);
  const serverUrl = useMemo(() => {
    if (!fallbackHost) return baseConfig.serverUrl;
    try {
      const u = new URL(baseConfig.serverUrl);
      u.hostname = fallbackHost;
      return u.toString().replace(/\/$/, "");
    } catch {
      return baseConfig.serverUrl;
    }
  }, [baseConfig.serverUrl, fallbackHost]);

  const endpoint = useMemo(() => {
    return baseConfig.apiKey ? `${serverUrl}/api/v1/prompts` : `${serverUrl}/library-items`;
  }, [baseConfig.apiKey, serverUrl]);

  const headers = baseConfig.headers;

  const [prompts, setPrompts] = useState<PromptHubItem[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<PromptHubItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 初始化加载本地记录的最近使用
  useEffect(() => {
    getRecentPrompts().then(setRecentPrompts);
  }, []);

  const fetchPrompts = useCallback(
    async (cursor?: string | null) => {
      // 若处于 recent 模式，数据直接走本地 Storage，不发起远端接口翻页
      if (filterMode === "recent") {
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        const trimmed = searchText.trim();
        if (trimmed) {
          qs.set("q", trimmed);
        }
        if (filterMode === "favorites") {
          qs.set("favorite", "true");
        } else if (filterMode !== "all") {
          qs.set("kind", filterMode);
        }
        if (cursor) {
          qs.set("cursor", cursor);
        }
        qs.set("limit", "30");

        const url = `${endpoint}?${qs.toString()}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
        }
        const json = (await res.json()) as PromptHubResponse;
        setPrompts((prev) => (cursor ? [...prev, ...(json.items || [])] : json.items || []));
        setNextCursor(json.nextCursor || null);
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        console.error("[PromptHelper] fetch error:", errorObj);
        setError(errorObj);
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, filterMode, headers, searchText],
  );

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleRecordUsage = useCallback(async (prompt: PromptHubItem) => {
    const updated = await recordPromptUsage(prompt);
    setRecentPrompts(updated);
  }, []);

  const handleClearRecent = useCallback(async () => {
    await clearRecentPrompts();
    setRecentPrompts([]);
    await showToast({
      style: Toast.Style.Success,
      title: "已清空最近使用记录",
    });
  }, []);

  const handleToggleFavorite = useCallback(
    async (prompt: PromptHubItem) => {
      const nextState = !prompt.favorited;
      // 乐观更新
      setPrompts((prev) => prev.map((p) => (p.id === prompt.id ? { ...p, favorited: nextState } : p)));
      setRecentPrompts((prev) => prev.map((p) => (p.id === prompt.id ? { ...p, favorited: nextState } : p)));

      try {
        const res = await toggleFavoritePrompt(serverUrl, baseConfig.apiKey, prompt.id, prompt.favorited);
        setPrompts((prev) => prev.map((p) => (p.id === prompt.id ? { ...p, favorited: res.favorited } : p)));
        const updatedRecent = await updateRecentPromptFavorite(prompt.id, res.favorited);
        setRecentPrompts(updatedRecent);

        await showToast({
          style: Toast.Style.Success,
          title: res.favorited ? "⭐ 已加入收藏" : "已取消收藏",
        });
      } catch (err: unknown) {
        // 失败回滚
        setPrompts((prev) => prev.map((p) => (p.id === prompt.id ? { ...p, favorited: prompt.favorited } : p)));
        setRecentPrompts((prev) => prev.map((p) => (p.id === prompt.id ? { ...p, favorited: prompt.favorited } : p)));
        const errMsg = err instanceof Error ? err.message : String(err);
        await showToast({
          style: Toast.Style.Failure,
          title: "收藏操作失败",
          message: errMsg,
        });
      }
    },
    [baseConfig.apiKey, serverUrl],
  );

  const currentHostname = useMemo(() => {
    try {
      return new URL(serverUrl).hostname;
    } catch {
      return "127.0.0.1";
    }
  }, [serverUrl]);

  const alternateHost =
    currentHostname === "127.0.0.1" ? "localhost" : currentHostname === "localhost" ? "127.0.0.1" : null;

  // 渲染单个 Prompt Item
  const renderItem = (prompt: PromptHubItem) => {
    const hasPlaceholders = prompt.placeholders && prompt.placeholders.length > 0;
    const displayTitle = prompt.title || prompt.content.slice(0, 30);
    const subtitle =
      prompt.models && prompt.models.length > 0
        ? prompt.models.join(", ")
        : prompt.tags && prompt.tags.length > 0
          ? `#${prompt.tags[0]}`
          : undefined;

    const accessories: List.Item.Accessory[] = [];

    if (prompt.favorited) {
      accessories.push({
        icon: { source: Icon.Star, tintColor: Color.Yellow },
        tooltip: "已收藏",
      });
    }

    if (hasPlaceholders) {
      accessories.push({
        tag: {
          value: `${prompt.placeholders.length} 变量`,
          color: Color.Purple,
        },
        tooltip: `包含占位符: ${prompt.placeholders.join(", ")}`,
      });
    } else {
      accessories.push({
        tag: { value: prompt.kind, color: Color.SecondaryText },
      });
    }

    return (
      <List.Item
        key={prompt.id}
        icon={getKindIcon(prompt.kind)}
        title={displayTitle}
        subtitle={subtitle}
        accessories={accessories}
        detail={
          <List.Item.Detail
            markdown={buildDetailMarkdown(prompt, serverUrl)}
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="类型" text={KIND_LABELS[prompt.kind]?.label || prompt.kind} />
                {prompt.rating !== null && prompt.rating !== undefined && (
                  <List.Item.Detail.Metadata.Label title="评分" text={"★".repeat(prompt.rating)} />
                )}
                {prompt.models && prompt.models.length > 0 && (
                  <List.Item.Detail.Metadata.TagList title="推荐模型">
                    {prompt.models.map((m) => (
                      <List.Item.Detail.Metadata.TagList.Item key={m} text={m} color={Color.Blue} />
                    ))}
                  </List.Item.Detail.Metadata.TagList>
                )}
                {prompt.tags && prompt.tags.length > 0 && (
                  <List.Item.Detail.Metadata.TagList title="标签">
                    {prompt.tags.map((t) => (
                      <List.Item.Detail.Metadata.TagList.Item key={t} text={t} color={Color.Green} />
                    ))}
                  </List.Item.Detail.Metadata.TagList>
                )}
                {hasPlaceholders && (
                  <List.Item.Detail.Metadata.TagList title="占位符">
                    {prompt.placeholders.map((ph) => {
                      const defVal = prompt.placeholderDefaults?.[ph];
                      return (
                        <List.Item.Detail.Metadata.TagList.Item
                          key={ph}
                          text={defVal ? `${ph} (${defVal})` : ph}
                          color={Color.Purple}
                        />
                      );
                    })}
                  </List.Item.Detail.Metadata.TagList>
                )}
                <List.Item.Detail.Metadata.Separator />
                {prompt.source?.type && <List.Item.Detail.Metadata.Label title="来源类型" text={prompt.source.type} />}
                {prompt.source?.author && (
                  <List.Item.Detail.Metadata.Label title="创作者" text={prompt.source.author} />
                )}
                {prompt.source?.url && (
                  <List.Item.Detail.Metadata.Link
                    title="来源链接"
                    target={prompt.source.url}
                    text={prompt.source.url}
                  />
                )}
                <List.Item.Detail.Metadata.Label
                  title="创建时间"
                  text={new Date(prompt.createdAt).toLocaleDateString()}
                />
              </List.Item.Detail.Metadata>
            }
          />
        }
        actions={
          <ActionPanel>
            {hasPlaceholders ? (
              <>
                <Action.Push
                  title="Fill Placeholders & Paste"
                  icon={Icon.Window}
                  target={<FillPlaceholdersForm prompt={prompt} serverUrl={serverUrl} />}
                />
                <Action.Paste
                  title="Paste Raw Template"
                  content={prompt.content}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
                  onPaste={() => handleRecordUsage(prompt)}
                />
                <Action.CopyToClipboard
                  title="Copy Raw Template"
                  content={prompt.content}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                  onCopy={() => handleRecordUsage(prompt)}
                />
              </>
            ) : (
              <>
                <Action.Paste
                  title="Paste into Active App"
                  icon={Icon.Clipboard}
                  content={prompt.content}
                  onPaste={() => handleRecordUsage(prompt)}
                />
                <Action.CopyToClipboard
                  title="Copy to Clipboard"
                  icon={Icon.CopyClipboard}
                  content={prompt.content}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                  onCopy={() => handleRecordUsage(prompt)}
                />
              </>
            )}
            <ActionPanel.Section>
              <Action
                title={prompt.favorited ? "取消收藏" : "加入收藏"}
                icon={{
                  source: Icon.Star,
                  tintColor: prompt.favorited ? Color.Yellow : undefined,
                }}
                shortcut={{ modifiers: ["cmd"], key: "d" }}
                onAction={() => handleToggleFavorite(prompt)}
              />
              <Action.OpenInBrowser
                title="Open in PromptHub"
                icon={Icon.Globe}
                url={`${serverUrl}/p/${prompt.id}/use`}
                shortcut={Keyboard.Shortcut.Common.Open}
              />
              {prompt.source?.url && (
                <Action.OpenInBrowser title="Open Source Link" icon={Icon.Link} url={prompt.source.url} />
              )}
              <Action
                title="Reload Prompts"
                icon={Icon.ArrowClockwise}
                onAction={() => fetchPrompts()}
                shortcut={Keyboard.Shortcut.Common.Refresh}
              />
              {filterMode === "recent" && (
                <Action
                  title="清空最近使用记录"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={handleClearRecent}
                />
              )}
              <Action title="Open Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  };

  // 1. 最近使用视图分支
  const displayedRecent = useMemo(() => {
    if (filterMode !== "recent") return [];
    return searchText.trim() ? recentPrompts.filter((p) => matchPrompt(p, searchText)) : recentPrompts;
  }, [filterMode, recentPrompts, searchText]);

  // 2. 综合智能流分段（仅当 filterMode 为 all 且无搜索输入时）
  const isSmartSections = filterMode === "all" && !searchText.trim();
  const recentSubset = useMemo(() => {
    if (!isSmartSections) return [];
    return recentPrompts.slice(0, 5);
  }, [isSmartSections, recentPrompts]);

  const recentSubsetIds = useMemo(() => new Set(recentSubset.map((p) => p.id)), [recentSubset]);

  const favoriteSubset = useMemo(() => {
    if (!isSmartSections) return [];
    return prompts.filter((p) => p.favorited && !recentSubsetIds.has(p.id));
  }, [isSmartSections, prompts, recentSubsetIds]);

  const favoriteSubsetIds = useMemo(() => new Set(favoriteSubset.map((p) => p.id)), [favoriteSubset]);

  const remainingSubset = useMemo(() => {
    if (!isSmartSections) return [];
    return prompts.filter((p) => !recentSubsetIds.has(p.id) && !favoriteSubsetIds.has(p.id));
  }, [isSmartSections, prompts, recentSubsetIds, favoriteSubsetIds]);

  const isEmpty = useMemo(() => {
    if (filterMode === "recent") return displayedRecent.length === 0;
    return prompts.length === 0 && !isLoading;
  }, [filterMode, displayedRecent.length, prompts.length, isLoading]);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      pagination={
        filterMode !== "recent"
          ? {
              pageSize: 30,
              hasMore: Boolean(nextCursor),
              onLoadMore: () => {
                if (nextCursor && !isLoading) {
                  fetchPrompts(nextCursor);
                }
              },
            }
          : undefined
      }
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="搜索提示词、正文、标签或生图模型..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="按分类或视图筛选"
          value={filterMode}
          onChange={(newMode) => setFilterMode(newMode as FilterMode)}
        >
          {FILTER_OPTIONS.map((opt) => (
            <List.Dropdown.Item key={opt.id} value={opt.id} title={opt.label} icon={getFilterIcon(opt.id)} />
          ))}
        </List.Dropdown>
      }
    >
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title={error.name ? `[${error.name}] ${error.message}` : "无法连接到 PromptHub 服务"}
          description={`请求端点: ${endpoint}\n\n排查建议：\n1. 请确认本地 Next.js 服务已启动（http://127.0.0.1:3210）\n2. 若开启了科学上网/代理工具，请确认 127.0.0.1 / localhost 在代理软件中已设为直连旁路\n3. 可尝试点击下方「切换为 ${alternateHost || "备用地址"} 尝试」`}
          actions={
            <ActionPanel>
              <Action title="重试连接" icon={Icon.ArrowClockwise} onAction={() => fetchPrompts()} />
              {alternateHost && (
                <Action
                  title={`切换为 ${alternateHost} 尝试`}
                  icon={Icon.Network}
                  onAction={() => setFallbackHost(alternateHost)}
                />
              )}
              <Action.CopyToClipboard
                title="复制错误详情"
                icon={Icon.CopyClipboard}
                content={`Endpoint: ${endpoint}\nError: ${error.name}: ${error.message}\nStack: ${error.stack || ""}`}
              />
              <Action.OpenInBrowser title="在浏览器中测试打开 PromptHub" url={serverUrl} />
              <Action title="打开插件设置" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      ) : isEmpty ? (
        <List.EmptyView
          icon={
            filterMode === "favorites"
              ? { source: Icon.Star, tintColor: Color.Yellow }
              : filterMode === "recent"
                ? { source: Icon.Clock, tintColor: Color.Blue }
                : Icon.MagnifyingGlass
          }
          title={
            filterMode === "favorites"
              ? "暂无收藏的提示词"
              : filterMode === "recent"
                ? "暂无最近使用的提示词"
                : "未找到匹配的提示词"
          }
          description={
            filterMode === "favorites"
              ? searchText
                ? `未在收藏中找到与「${searchText}」匹配的结果`
                : "可在任何提示词卡片上使用 ⌘D 快捷键加入收藏"
              : filterMode === "recent"
                ? searchText
                  ? `未在最近使用中找到与「${searchText}」匹配的结果`
                  : "复制或粘贴过的提示词将自动记录在这里"
                : searchText
                  ? `未找到与「${searchText}」匹配的结果，试试其他关键词`
                  : "PromptHub 库中暂无该类型的内容"
          }
          actions={
            <ActionPanel>
              <Action title="刷新列表" icon={Icon.ArrowClockwise} onAction={() => fetchPrompts()} />
              <Action.OpenInBrowser title="在浏览器中打开 PromptHub" url={serverUrl} />
            </ActionPanel>
          }
        />
      ) : filterMode === "recent" ? (
        <List.Section title="🕒 最近使用" subtitle={`${displayedRecent.length} 条`}>
          {displayedRecent.map(renderItem)}
        </List.Section>
      ) : filterMode === "favorites" ? (
        <List.Section title="⭐ 我的收藏" subtitle={`${prompts.length} 条`}>
          {prompts.map(renderItem)}
        </List.Section>
      ) : isSmartSections ? (
        <>
          {recentSubset.length > 0 && (
            <List.Section title="🕒 最近使用" subtitle={`${recentSubset.length} 条`}>
              {recentSubset.map(renderItem)}
            </List.Section>
          )}
          {favoriteSubset.length > 0 && (
            <List.Section title="⭐ 我的收藏" subtitle={`${favoriteSubset.length} 条`}>
              {favoriteSubset.map(renderItem)}
            </List.Section>
          )}
          {remainingSubset.length > 0 && (
            <List.Section title="全部提示词" subtitle={`${remainingSubset.length} 条`}>
              {remainingSubset.map(renderItem)}
            </List.Section>
          )}
        </>
      ) : (
        prompts.map(renderItem)
      )}
    </List>
  );
}
