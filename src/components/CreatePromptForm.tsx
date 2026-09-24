import { Action, ActionPanel, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { useCallback, useState } from "react";
import { CreatePromptInput, PromptHubItem, extractAllPlaceholders } from "../types";
import { createPromptApi, recordPromptUsage } from "../utils";

interface Props {
  serverUrl: string;
  apiKey?: string;
  onCreated: (item: PromptHubItem) => void;
}

export function CreatePromptForm({ serverUrl, apiKey, onCreated }: Props) {
  const { pop } = useNavigation();
  const [contentError, setContentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (values: {
      title?: string;
      kind: string;
      content: string;
      tags?: string;
      model?: string;
      usage_notes?: string;
    }) => {
      const content = values.content?.trim();
      if (!content) {
        setContentError("提示词正文不能为空");
        return;
      }
      setContentError(undefined);
      setIsSubmitting(true);

      try {
        const tags = values.tags
          ? values.tags
              .split(/[,，]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

        const input: CreatePromptInput = {
          title: values.title?.trim() || undefined,
          content,
          kind: values.kind || "text",
          tags,
          model: values.model?.trim() || undefined,
          usage_notes: values.usage_notes?.trim() || undefined,
        };

        const res = await createPromptApi(serverUrl, apiKey, input);

        // 构造返回给列表的 PromptHubItem
        const placeholders = extractAllPlaceholders(content);
        const newItem: PromptHubItem = {
          id: res.id,
          title: input.title || null,
          content: input.content,
          kind: input.kind || "text",
          placeholders,
          placeholderDefaults: {},
          tags,
          models: input.model ? [input.model] : [],
          rating: null,
          favorited: false,
          coverSha: null,
          coverThumbSha: null,
          source: { type: "self", url: null, author: null },
          createdAt: new Date().toISOString(),
        };

        // 自动记录为最近使用
        await recordPromptUsage(newItem);
        onCreated(newItem);

        await showToast({
          style: Toast.Style.Success,
          title: "✨ 提示词创建成功",
        });

        pop();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await showToast({
          style: Toast.Style.Failure,
          title: "创建失败",
          message: msg,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiKey, onCreated, pop, serverUrl],
  );

  return (
    <Form
      navigationTitle="新建提示词 (Create Prompt)"
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Prompt" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="标题" placeholder="例如：赛博朋克夜景插画（可选）" />
      <Form.Dropdown id="kind" title="类型" defaultValue="text">
        <Form.Dropdown.Item value="text" title="文本 (Text)" icon={Icon.Document} />
        <Form.Dropdown.Item value="image" title="生图 (Image)" icon={Icon.Image} />
        <Form.Dropdown.Item value="code" title="代码 (Code)" icon={Icon.Code} />
        <Form.Dropdown.Item value="video" title="视频 (Video)" icon={Icon.Video} />
        <Form.Dropdown.Item value="audio" title="音频 (Audio)" icon={Icon.Music} />
      </Form.Dropdown>
      <Form.TextArea
        id="content"
        title="提示词正文"
        placeholder="输入提示词内容。支持使用 [变量名] 或 {{变量名}} 定义占位符"
        error={contentError}
        onChange={() => {
          if (contentError) setContentError(undefined);
        }}
      />
      <Form.TextField id="tags" title="标签" placeholder="多个标签逗号分隔，如：portrait, cyberpunk" />
      <Form.TextField id="model" title="推荐模型" placeholder="例如：Midjourney v6 或 Claude 3.5 Sonnet" />
      <Form.TextField id="usage_notes" title="使用说明" placeholder="例如：建议权重 --ar 16:9（可选）" />
    </Form>
  );
}
