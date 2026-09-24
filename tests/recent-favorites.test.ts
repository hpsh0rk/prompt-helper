import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptHubItem } from "../src/types";
import {
  clearRecentPrompts,
  getCachedPrompts,
  getRecentPrompts,
  recordPromptUsage,
  saveCachedPrompts,
  toggleFavoritePrompt,
  updateRecentPromptFavorite,
} from "../src/utils";

const mockItem1: PromptHubItem = {
  id: "prompt-1",
  title: "First Prompt",
  content: "Content 1",
  kind: "text",
  placeholders: [],
  placeholderDefaults: {},
  tags: ["tag1"],
  models: [],
  rating: null,
  favorited: false,
  coverSha: null,
  coverThumbSha: null,
  source: { type: "self", url: null, author: null },
  createdAt: "2026-09-23T12:00:00Z",
};

const mockItem2: PromptHubItem = {
  id: "prompt-2",
  title: "Second Prompt",
  content: "Content 2",
  kind: "image",
  placeholders: ["style"],
  placeholderDefaults: { style: "cyberpunk" },
  tags: ["art"],
  models: ["mj"],
  rating: 5,
  favorited: true,
  coverSha: "cover-sha",
  coverThumbSha: null,
  source: { type: "self", url: null, author: null },
  createdAt: "2026-09-23T12:05:00Z",
};

describe("Recent Prompts Management", () => {
  beforeEach(async () => {
    await clearRecentPrompts();
  });

  it("returns empty array initially", async () => {
    const list = await getRecentPrompts();
    expect(list).toEqual([]);
  });

  it("records a prompt usage and prepends to the list", async () => {
    const after1 = await recordPromptUsage(mockItem1);
    expect(after1.length).toBe(1);
    expect(after1[0].id).toBe("prompt-1");

    const after2 = await recordPromptUsage(mockItem2);
    expect(after2.length).toBe(2);
    expect(after2[0].id).toBe("prompt-2");
    expect(after2[1].id).toBe("prompt-1");
  });

  it("deduplicates and bumps existing item to top", async () => {
    await recordPromptUsage(mockItem1);
    await recordPromptUsage(mockItem2);
    const updated = await recordPromptUsage(mockItem1);

    expect(updated.length).toBe(2);
    expect(updated[0].id).toBe("prompt-1");
    expect(updated[1].id).toBe("prompt-2");
  });

  it("updates favorite status within recent prompts", async () => {
    await recordPromptUsage(mockItem1);
    expect((await getRecentPrompts())[0].favorited).toBe(false);

    const updated = await updateRecentPromptFavorite("prompt-1", true);
    expect(updated[0].favorited).toBe(true);

    const reloaded = await getRecentPrompts();
    expect(reloaded[0].favorited).toBe(true);
  });

  it("clears all recent prompts", async () => {
    await recordPromptUsage(mockItem1);
    await recordPromptUsage(mockItem2);
    expect((await getRecentPrompts()).length).toBe(2);

    await clearRecentPrompts();
    expect((await getRecentPrompts()).length).toBe(0);
  });
});

describe("toggleFavoritePrompt API Call", () => {
  it("toggles favorite via local endpoint when apiKey is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ favorited: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await toggleFavoritePrompt("http://127.0.0.1:3210", undefined, "prompt-1", false);
    expect(res).toEqual({ favorited: true });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/library-items/favorite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt_id: "prompt-1" }),
    });
  });

  it("uses PUT in cloud PAT mode when adding to favorites", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ favorited: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await toggleFavoritePrompt("https://hub.example.com", "my-pat-key", "prompt-1", false);
    expect(res).toEqual({ favorited: true });
    expect(fetchMock).toHaveBeenCalledWith("https://hub.example.com/api/v1/favorites", {
      method: "PUT",
      headers: {
        Authorization: "Bearer my-pat-key",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt_id: "prompt-1" }),
    });
  });

  it("uses DELETE in cloud PAT mode when removing from favorites", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ favorited: false }),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const res = await toggleFavoritePrompt("https://hub.example.com", "my-pat-key", "prompt-1", true);
    expect(res).toEqual({ favorited: false });
    expect(fetchMock).toHaveBeenCalledWith("https://hub.example.com/api/v1/favorites?prompt_id=prompt-1", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer my-pat-key",
        Accept: "application/json",
      },
    });
  });
});

describe("Cached Prompts SWR Snapshot", () => {
  it("returns empty array when cache is empty", async () => {
    const cached = await getCachedPrompts();
    expect(cached).toEqual([]);
  });

  it("saves and retrieves cached prompts", async () => {
    await saveCachedPrompts([mockItem1, mockItem2]);
    const cached = await getCachedPrompts();
    expect(cached.length).toBe(2);
    expect(cached[0].id).toBe("prompt-1");
    expect(cached[1].id).toBe("prompt-2");
  });

  it("caps cached prompts at 50 items", async () => {
    const manyItems: PromptHubItem[] = Array.from({ length: 60 }, (_, i) => ({
      ...mockItem1,
      id: `prompt-${i}`,
      title: `Prompt ${i}`,
    }));
    await saveCachedPrompts(manyItems);
    const cached = await getCachedPrompts();
    expect(cached.length).toBe(50);
    expect(cached[0].id).toBe("prompt-0");
    expect(cached[49].id).toBe("prompt-49");
  });
});
