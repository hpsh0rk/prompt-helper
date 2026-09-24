import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Icon,
  Keyboard,
  List,
  Toast,
  confirmAlert,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreatePromptForm } from "./components/CreatePromptForm";
import { FillPlaceholdersForm } from "./components/FillPlaceholdersForm";
import { FILTER_OPTIONS, FilterMode, KIND_LABELS, PromptHubItem, PromptHubResponse } from "./types";
import {
  buildDetailMarkdown,
  clearRecentPrompts,
  deletePromptApi,
  getApiConfig,
  getKindIcon,
  getRecentPrompts,
  getSavedDefaultView,
  getSyncCachedDefaultView,
  getSyncCachedPrompts,
  getSyncCachedRecent,
  isCacheFresh,
  recordPromptUsage,
  removeRecentPrompt,
  saveCachedPrompts,
  saveDefaultView,
  toggleFavoritePrompt,
  updateRecentPromptFavorite,
} from "./utils";

function getFetch() {
  if (typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node-fetch") as typeof globalThis.fetch;
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
  const baseConfig = useMemo(() => getApiConfig(), []);

  const initialDefaultView = useMemo(() => {
    return getSyncCachedDefaultView() || baseConfig.defaultView || "all";
  }, [baseConfig.defaultView]);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [defaultView, setDefaultView] = useState<FilterMode>(initialDefaultView);
  const [filterMode, setFilterMode] = useState<FilterMode>(initialDefaultView);
  const [fallbackHost, setFallbackHost] = useState<string | null>(null);

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

  // 0ms 同步秒开数据，首帧直接从内存/本地 Cache 还原
  const [prompts, setPrompts] = useState<PromptHubItem[]>(getSyncCachedPrompts);
  const [recentPrompts, setRecentPrompts] = useState<PromptHubItem[]>(getSyncCachedRecent);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 首屏若已同步读到缓存，isLoading 初始直接为 false，零菊花转圈
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (initialDefaultView === "recent") return false;
    const initialCached = getSyncCachedPrompts();
    return initialCached.length === 0;
  });
  const [error, setError] = useState<Error | null>(null);

  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;

  // 搜索输入 250ms 防抖，避免打字时每敲一个按键都高频触发网络请求卡顿主线程
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  // 兜底异步检查持久化数据（若 Cache 冷启动为空时从 LocalStorage 回填）
  useEffect(() => {
    if (recentPrompts.length === 0) {
      getRecentPrompts().then((list) => {
        if (list.length > 0) setRecentPrompts(list);
      });
    }
    getSavedDefaultView().then((saved) => {
      if (saved && saved !== defaultView) {
        setDefaultView(saved);
        setFilterMode(saved);
      }
    });
  }, []);

  const handleSetDefaultView = useCallback(async (view: FilterMode) => {
    await saveDefaultView(view);
    setDefaultView(view);
    setFilterMode(view);
    const viewLabels: Record<string, string> = {
      all: "全部提示词 (智能分段)",
      favorites: "⭐ 我的收藏",
      recent: "🕒 最近使用",
    };
    await showToast({
      style: Toast.Style.Success,
      title: `已将「${viewLabels[view] || view}」设为默认视图`,
      message: "下次打开插件将自动进入此视图",
    });
  }, []);

  const fetchPrompts = useCallback(
    async (options?: { cursor?: string | null; isSilent?: boolean; search?: string; mode?: FilterMode }) => {
      const mode = options?.mode ?? filterMode;
      const search = options?.search ?? debouncedSearchText;
      const cursor = options?.cursor ?? null;
      const isSilent = options?.isSilent ?? false;

      // 若处于 recent 模式，数据直接走本地 Storage/Cache，不发起远端接口请求
      if (mode === "recent") {
        setIsLoading(false);
        setError(null);
        return;
      }

      if (!isSilent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const qs = new URLSearchParams();
        const trimmed = search.trim();
        if (trimmed) {
          qs.set("q", trimmed);
        }
        if (mode === "favorites") {
          qs.set("favorite", "true");
        } else if (mode !== "all") {
          qs.set("kind", mode);
        }
        if (cursor) {
          qs.set("cursor", cursor);
        }
        qs.set("limit", "30");

        const url = `${endpoint}?${qs.toString()}`;
        const f = getFetch();
        const res = await f(url, { headers });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
        }
        const json = (await res.json()) as PromptHubResponse;
        const fetchedItems = json.items || [];

        if (cursor) {
          setPrompts((prev) => [...prev, ...fetchedItems]);
        } else {
          // 若为静默刷新，比对新老数据 ID 列表，无变动时不触发重绘
          if (isSilent) {
            const oldIds = promptsRef.current.map((p) => p.id).join(",");
            const newIds = fetchedItems.map((p) => p.id).join(",");
            if (oldIds !== newIds) {
              setPrompts(fetchedItems);
            }
          } else {
            setPrompts(fetchedItems);
          }

          // 仅在全部视图、无搜索、第一页时更新快照
          if (!trimmed && mode === "all") {
            saveCachedPrompts(fetchedItems).catch(() => {});
          }
        }
        setNextCursor(json.nextCursor || null);
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        console.error("[PromptHelper] fetch error:", errorObj);
        // 静默后台对齐失败不报错打扰用户
        if (!isSilent) {
          setError(errorObj);
        }
      } finally {
        if (!isSilent) {
          setIsLoading(false);
        }
      }
    },
    [debouncedSearchText, endpoint, filterMode, headers],
  );

  // 1. 唤醒生命周期：后台异步按需对齐，绝不阻塞唤醒瞬间
  useEffect(() => {
    // 若初始视图为 recent，完全不发起网络请求
    if (initialDefaultView === "recent") return;

    // 若缓存处于新鲜期（60s 内），完全跳过网络请求，极致 0ms 纯离线
    if (isCacheFresh() && prompts.length > 0) return;

    // 若已超出新鲜期但已有缓存：延迟 600ms（避开刚唤醒时的线程争抢）在后台静默发起对齐
    const hasCache = prompts.length > 0;
    const delay = hasCache ? 600 : 0;

    const timer = setTimeout(() => {
      // 若用户尚未打字、且不在 recent 模式，在后台静默对齐
      if (!searchText.trim() && filterMode !== "recent") {
        fetchPrompts({ isSilent: hasCache, mode: filterMode });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  // 2. 用户主动交互响应（搜索词防抖变化，或手动切换了下拉视图）
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchPrompts({ search: debouncedSearchText, mode: filterMode, isSilent: false });
  }, [debouncedSearchText, filterMode]);

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

  const handleCreatedPrompt = useCallback((newItem: PromptHubItem) => {
    setPrompts((prev) => [newItem, ...prev]);
    setRecentPrompts((prev) => [newItem, ...prev.filter((p) => p.id !== newItem.id)]);
  }, []);

  const handleDeletePrompt = useCallback(
    async (prompt: PromptHubItem) => {
      const confirmed = await confirmAlert({
        title: "确定删除此提示词吗？",
        message: `将从 PromptHub 中移除「${prompt.title || prompt.content.slice(0, 30)}」`,
        primaryAction: {
          title: "确认删除",
          style: Alert.ActionStyle.Destructive,
        },
      });

      if (!confirmed) return;

      try {
        await deletePromptApi(serverUrl, baseConfig.apiKey, prompt.id);
        // 从当前列表移除
        setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
        // 从本地最近使用移除
        const updatedRecent = await removeRecentPrompt(prompt.id);
        setRecentPrompts(updatedRecent);

        await showToast({
          style: Toast.Style.Success,
          title: "提示词已删除",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await showToast({
          style: Toast.Style.Failure,
          title: "删除失败",
          message: msg,
        });
      }
    },
    [baseConfig.apiKey, serverUrl],
  );

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
              <Action.Push
                title="Create New Prompt"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                target={
                  <CreatePromptForm serverUrl={serverUrl} apiKey={baseConfig.apiKey} onCreated={handleCreatedPrompt} />
                }
              />
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
                onAction={() => fetchPrompts({ isSilent: false })}
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
            </ActionPanel.Section>

            <ActionPanel.Section title="视图与偏好">
              <ActionPanel.Submenu
                title="设置默认展示视图"
                icon={Icon.Eye}
                shortcut={Keyboard.Shortcut.Common.Duplicate}
              >
                <Action
                  title={`全部提示词 (智能分段)${defaultView === "all" ? " (当前默认)" : ""}`}
                  icon={defaultView === "all" ? Icon.Checkmark : Icon.List}
                  onAction={() => handleSetDefaultView("all")}
                />
                <Action
                  title={`⭐ 我的收藏 (Favorites)${defaultView === "favorites" ? " (当前默认)" : ""}`}
                  icon={defaultView === "favorites" ? Icon.Checkmark : Icon.Star}
                  onAction={() => handleSetDefaultView("favorites")}
                />
                <Action
                  title={`🕒 最近使用 (Recent)${defaultView === "recent" ? " (当前默认)" : ""}`}
                  icon={defaultView === "recent" ? Icon.Checkmark : Icon.Clock}
                  onAction={() => handleSetDefaultView("recent")}
                />
              </ActionPanel.Submenu>
              <Action
                title="打开插件偏好设置"
                icon={Icon.Gear}
                shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
                onAction={openExtensionPreferences}
              />
            </ActionPanel.Section>

            <ActionPanel.Section>
              <Action
                title="Delete Prompt"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["ctrl"], key: "x" }}
                onAction={() => handleDeletePrompt(prompt)}
              />
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
                  fetchPrompts({ cursor: nextCursor, isSilent: false });
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
              <Action title="重试连接" icon={Icon.ArrowClockwise} onAction={() => fetchPrompts({ isSilent: false })} />
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
              <Action
                title="打开插件偏好设置"
                icon={Icon.Gear}
                shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
                onAction={openExtensionPreferences}
              />
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
              <Action.Push
                title="Create New Prompt"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                target={
                  <CreatePromptForm serverUrl={serverUrl} apiKey={baseConfig.apiKey} onCreated={handleCreatedPrompt} />
                }
              />
              <Action title="刷新列表" icon={Icon.ArrowClockwise} onAction={() => fetchPrompts({ isSilent: false })} />
              <Action.OpenInBrowser title="在浏览器中打开 PromptHub" url={serverUrl} />
              <ActionPanel.Section title="视图与偏好">
                <ActionPanel.Submenu
                  title="设置默认展示视图"
                  icon={Icon.Eye}
                  shortcut={Keyboard.Shortcut.Common.Duplicate}
                >
                  <Action
                    title={`全部提示词 (智能分段)${defaultView === "all" ? " (当前默认)" : ""}`}
                    icon={defaultView === "all" ? Icon.Checkmark : Icon.List}
                    onAction={() => handleSetDefaultView("all")}
                  />
                  <Action
                    title={`⭐ 我的收藏 (Favorites)${defaultView === "favorites" ? " (当前默认)" : ""}`}
                    icon={defaultView === "favorites" ? Icon.Checkmark : Icon.Star}
                    onAction={() => handleSetDefaultView("favorites")}
                  />
                  <Action
                    title={`🕒 最近使用 (Recent)${defaultView === "recent" ? " (当前默认)" : ""}`}
                    icon={defaultView === "recent" ? Icon.Checkmark : Icon.Clock}
                    onAction={() => handleSetDefaultView("recent")}
                  />
                </ActionPanel.Submenu>
                <Action
                  title="打开插件偏好设置"
                  icon={Icon.Gear}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
                  onAction={openExtensionPreferences}
                />
              </ActionPanel.Section>
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
