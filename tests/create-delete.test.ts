import { describe, expect, it, vi } from "vitest";
import { PromptHubItem } from "../src/types";
import {
  clearRecentPrompts,
  createPromptApi,
  deletePromptApi,
  getApiConfig,
  getRecentPrompts,
  recordPromptUsage,
  removeRecentPrompt,
} from "../src/utils";

const mockItem: PromptHubItem = {
  id: "prompt-del-1",
  title: "To Be Deleted",
  content: "Content to be deleted",
  kind: "text",
  placeholders: [],
  placeholderDefaults: {},
  tags: ["temp"],
  models: [],
  rating: null,
  favorited: false,
  coverSha: null,
  coverThumbSha: null,
  source: { type: "self", url: null, author: null },
  createdAt: "2026-09-24T00:00:00Z",
};

describe("Prompt Creation & Deletion API", () => {
  it("creates prompt via local endpoint when apiKey is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-local-id", versionNo: 1 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await createPromptApi("http://127.0.0.1:3210", undefined, {
      title: "New Local Prompt",
      content: "A test prompt [subject]",
      kind: "text",
      tags: ["local", "test"],
    });

    expect(res).toEqual({ id: "new-local-id", versionNo: 1 });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/library-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: "New Local Prompt",
        content: "A test prompt [subject]",
        kind: "text",
        tags: ["local", "test"],
      }),
    });
  });

  it("creates prompt via cloud PAT endpoint when apiKey is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-cloud-id", versionNo: 1 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await createPromptApi("https://hub.example.com", "pat-secret-key", {
      title: "New Cloud Prompt",
      content: "Cloud content",
      kind: "image",
    });

    expect(res).toEqual({ id: "new-cloud-id", versionNo: 1 });
    expect(fetchMock).toHaveBeenCalledWith("https://hub.example.com/api/v1/prompts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer pat-secret-key",
      },
      body: JSON.stringify({
        title: "New Cloud Prompt",
        content: "Cloud content",
        kind: "image",
      }),
    });
  });

  it("deletes prompt via local endpoint when apiKey is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true, id: "prompt-del-1" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await deletePromptApi("http://127.0.0.1:3210", undefined, "prompt-del-1");
    expect(res).toEqual({ deleted: true, id: "prompt-del-1" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/library-items?id=prompt-del-1", {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });
  });

  it("deletes prompt via cloud PAT endpoint when apiKey is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true, soft: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await deletePromptApi("https://hub.example.com", "pat-secret-key", "prompt-del-1");
    expect(res).toEqual({ deleted: true, soft: true });
    expect(fetchMock).toHaveBeenCalledWith("https://hub.example.com/api/v1/prompts/prompt-del-1", {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer pat-secret-key",
      },
    });
  });
});

describe("removeRecentPrompt", () => {
  it("removes deleted prompt from local recent storage", async () => {
    await clearRecentPrompts();
    await recordPromptUsage(mockItem);
    const before = await getRecentPrompts();
    expect(before.length).toBe(1);

    const after = await removeRecentPrompt("prompt-del-1");
    expect(after.length).toBe(0);

    const reloaded = await getRecentPrompts();
    expect(reloaded.length).toBe(0);
  });
});

describe("getApiConfig defaults", () => {
  it("defaults defaultView to all if not set", () => {
    const cfg = getApiConfig();
    expect(cfg.defaultView).toBe("all");
  });
});

describe("default view local persistence", () => {
  it("saves and retrieves default view from local storage", async () => {
    const { getSavedDefaultView, saveDefaultView } = await import("../src/utils");
    await saveDefaultView("favorites");
    expect(await getSavedDefaultView()).toBe("favorites");

    await saveDefaultView("recent");
    expect(await getSavedDefaultView()).toBe("recent");

    await saveDefaultView("all");
    expect(await getSavedDefaultView()).toBe("all");
  });
});
