import { Action, ActionPanel, Clipboard, Form, Icon, popToRoot, showHUD, showToast, Toast } from "@raycast/api";
import { useCallback, useMemo } from "react";
import { PromptHubItem, extractAllPlaceholders, substitutePlaceholders } from "../types";
import { recordPromptUsage } from "../utils";

interface Props {
  prompt: PromptHubItem;
  serverUrl: string;
}

export function FillPlaceholdersForm({ prompt }: Props) {
  // 提取所有占位符（优先取后端已提取的，兼容易漏网的 {{var}}）
  const allPlaceholders = useMemo(() => {
    const fromApi = prompt.placeholders || [];
    const fromContent = extractAllPlaceholders(prompt.content);
    const combined = Array.from(new Set([...fromApi, ...fromContent]));
    return combined;
  }, [prompt]);

  const handlePaste = useCallback(
    async (values: Record<string, string>) => {
      // 聚合最终取值：优先表单填写值，未填时自动回退至参考默认值
      const finalValues: Record<string, string> = {};
      for (const ph of allPlaceholders) {
        const inputVal = values[ph]?.trim();
        const defaultVal = prompt.placeholderDefaults?.[ph] ?? "";
        finalValues[ph] = inputVal !== undefined && inputVal !== "" ? inputVal : defaultVal;
      }

      const rendered = substitutePlaceholders(prompt.content, finalValues);
      await Clipboard.paste(rendered);
      await recordPromptUsage(prompt);
      await showHUD("✨ 已替换参数并粘贴至当前应用");
      popToRoot();
    },
    [prompt, allPlaceholders],
  );

  const handleCopy = useCallback(
    async (values: Record<string, string>) => {
      const finalValues: Record<string, string> = {};
      for (const ph of allPlaceholders) {
        const inputVal = values[ph]?.trim();
        const defaultVal = prompt.placeholderDefaults?.[ph] ?? "";
        finalValues[ph] = inputVal !== undefined && inputVal !== "" ? inputVal : defaultVal;
      }

      const rendered = substitutePlaceholders(prompt.content, finalValues);
      await Clipboard.copy(rendered);
      await recordPromptUsage(prompt);
      await showToast({
        style: Toast.Style.Success,
        title: "已复制渲染后提示词",
      });
      popToRoot();
    },
    [prompt, allPlaceholders],
  );

  return (
    <Form
      navigationTitle={`填写占位符: ${prompt.title || "未命名提示词"}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Paste into Active App" icon={Icon.Clipboard} onSubmit={handlePaste} />
          <Action.SubmitForm title="Copy to Clipboard" icon={Icon.CopyClipboard} onSubmit={handleCopy} />
        </ActionPanel>
      }
    >
      <Form.Description
        text={
          prompt.title
            ? `正在为「${prompt.title}」填入变量。直接按回车即可使用推荐默认值。`
            : "正在填写提示词占位符。直接按回车即可使用推荐默认值。"
        }
      />
      {allPlaceholders.map((ph) => {
        const defaultVal = prompt.placeholderDefaults?.[ph] ?? "";
        return (
          <Form.TextField
            key={ph}
            id={ph}
            title={ph}
            placeholder={defaultVal ? `参考值: ${defaultVal}` : `请输入 ${ph}`}
            defaultValue={defaultVal}
          />
        );
      })}
    </Form>
  );
}
