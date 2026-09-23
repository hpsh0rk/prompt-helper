import { Action, ActionPanel, Color, Icon, List, openExtensionPreferences, Keyboard } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useMemo, useState } from "react";
import { FillPlaceholdersForm } from "./components/FillPlaceholdersForm";
import { KIND_LABELS, PromptHubItem, PromptHubResponse } from "./types";
import { buildDetailMarkdown, getApiConfig, getKindIcon } from "./utils";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [selectedKind, setSelectedKind] = useState("all");

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

  const { isLoading, data, pagination, revalidate, error } = useFetch(
    (options) => {
      const qs = new URLSearchParams();
      const trimmed = searchText.trim();
      if (trimmed) {
        qs.set("q", trimmed);
      }
      if (selectedKind && selectedKind !== "all") {
        qs.set("kind", selectedKind);
      }
      if (options.cursor) {
        qs.set("cursor", options.cursor);
      }
      qs.set("limit", "30");
      return `${endpoint}?${qs.toString()}`;
    },
    {
      headers,
      keepPreviousData: true,
      onError(err) {
        console.error("[PromptHelper] useFetch error:", err);
      },
      async parseResponse(response): Promise<PromptHubResponse> {
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
        }
        return (await response.json()) as PromptHubResponse;
      },
      mapResult(result: PromptHubResponse) {
        return {
          data: (result?.items || []) as PromptHubItem[],
          hasMore: Boolean(result?.nextCursor),
          cursor: result?.nextCursor,
        };
      },
    },
  );

  const prompts: PromptHubItem[] = data || [];

  const currentHostname = useMemo(() => {
    try {
      return new URL(serverUrl).hostname;
    } catch {
      return "127.0.0.1";
    }
  }, [serverUrl]);

  const alternateHost =
    currentHostname === "127.0.0.1" ? "localhost" : currentHostname === "localhost" ? "127.0.0.1" : null;

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      pagination={pagination}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="搜索提示词、正文、标签或生图模型..."
      searchBarAccessory={
        <List.Dropdown tooltip="按类型筛选" value={selectedKind} onChange={(newKind) => setSelectedKind(newKind)}>
          {Object.entries(KIND_LABELS).map(([k, meta]) => (
            <List.Dropdown.Item key={k} value={k} title={meta.label} />
          ))}
        </List.Dropdown>
      }
    >
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="无法连接到 PromptHub 服务"
          description={`请求端点: ${endpoint}\n错误原因: ${error.name ? `[${error.name}] ` : ""}${error.message || String(error)}\n\n排查建议：\n1. 请确认本地 Next.js 服务已启动（http://127.0.0.1:3210）\n2. 若开启了科学上网/代理工具，请确认 127.0.0.1 / localhost 在代理软件中已设为直连旁路\n3. 可尝试点击下方「切换为 ${alternateHost || "备用地址"} 尝试」`}
          actions={
            <ActionPanel>
              <Action title="重试连接" icon={Icon.ArrowClockwise} onAction={revalidate} />
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
      ) : prompts.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="未找到匹配的提示词"
          description={
            searchText ? `未找到与「${searchText}」匹配的结果，试试其他关键词` : "PromptHub 库中暂无该类型的内容"
          }
          actions={
            <ActionPanel>
              <Action title="刷新列表" icon={Icon.ArrowClockwise} onAction={revalidate} />
              <Action.OpenInBrowser title="在浏览器中打开 PromptHub" url={serverUrl} />
            </ActionPanel>
          }
        />
      ) : (
        prompts.map((prompt) => {
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
                      <List.Item.Detail.Metadata.Label
                        title="类型"
                        text={KIND_LABELS[prompt.kind]?.label || prompt.kind}
                      />
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
                      {prompt.source?.type && (
                        <List.Item.Detail.Metadata.Label title="来源类型" text={prompt.source.type} />
                      )}
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
                      />
                      <Action.CopyToClipboard
                        title="Copy Raw Template"
                        content={prompt.content}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                    </>
                  ) : (
                    <>
                      <Action.Paste title="Paste into Active App" icon={Icon.Clipboard} content={prompt.content} />
                      <Action.CopyToClipboard
                        title="Copy to Clipboard"
                        icon={Icon.CopyClipboard}
                        content={prompt.content}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                    </>
                  )}
                  <ActionPanel.Section>
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
                      onAction={revalidate}
                      shortcut={Keyboard.Shortcut.Common.Refresh}
                    />
                    <Action title="Open Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
