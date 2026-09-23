import { Icon, getPreferenceValues } from "@raycast/api";
import { Preferences, PromptHubItem } from "./types";

export function getApiConfig() {
  const prefs = getPreferenceValues<Preferences>();
  let serverUrl = (prefs.serverUrl || "http://127.0.0.1:3210").trim();
  if (serverUrl.endsWith("/")) {
    serverUrl = serverUrl.slice(0, -1);
  }
  const apiKey = (prefs.apiKey || "").trim();

  // 若提供了 PAT，走标准对外 API /api/v1/prompts；若未提供，本地回退到免鉴权 /library-items 端点
  const endpoint = apiKey ? `${serverUrl}/api/v1/prompts` : `${serverUrl}/library-items`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return { serverUrl, apiKey, endpoint, headers };
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
