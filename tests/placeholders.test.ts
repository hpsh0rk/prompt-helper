import { describe, expect, it } from "vitest";
import { extractAllPlaceholders, substitutePlaceholders, PromptHubItem } from "../src/types";
import { buildDetailMarkdown } from "../src/utils";

describe("Placeholder Parsing and Substitution", () => {
  it("extracts [bracket] placeholders accurately", () => {
    const text = "A futuristic [subject] in [city] under [lighting] lighting";
    expect(extractAllPlaceholders(text)).toEqual(["subject", "city", "lighting"]);
  });

  it("extracts {{double_brace}} placeholders accurately for backwards compatibility", () => {
    const text = "A portrait of {{character}} wearing {{outfit}}";
    expect(extractAllPlaceholders(text)).toEqual(["character", "outfit"]);
  });

  it("handles mixed placeholders without duplicating keys", () => {
    const text = "[role] playing {{role}} with [weapon] and {{weapon}}";
    expect(extractAllPlaceholders(text)).toEqual(["role", "weapon"]);
  });

  it("substitutes both [bracket] and {{brace}} placeholders with given values", () => {
    const template = "Create a [style] poster of {{subject}} with [ratio] aspect ratio";
    const values = {
      style: "Cyberpunk",
      subject: "Neon Samurai",
      ratio: "16:9",
    };
    const rendered = substitutePlaceholders(template, values);
    expect(rendered).toBe("Create a Cyberpunk poster of Neon Samurai with 16:9 aspect ratio");
  });

  it("handles empty values and preserves unsupplied placeholders", () => {
    const template = "[title]: [subtitle]";
    const rendered = substitutePlaceholders(template, { title: "Hello", subtitle: "" });
    expect(rendered).toBe("Hello: ");

    const partial = substitutePlaceholders(template, { title: "Hello" });
    expect(partial).toBe("Hello: [subtitle]");
  });
});

describe("buildDetailMarkdown", () => {
  it("includes preview image when coverThumbSha or coverSha is present", () => {
    const item: PromptHubItem = {
      id: "test-id",
      title: "Test Image Prompt",
      content: "A cute cat",
      kind: "image",
      placeholders: [],
      placeholderDefaults: {},
      tags: ["cute", "cat"],
      models: ["mj-v6"],
      rating: 5,
      favorited: true,
      coverSha: "abc123sha",
      coverThumbSha: "thumb123sha",
      source: { type: "self", url: null, author: null },
      createdAt: "2026-09-23T12:00:00Z",
    };
    const md = buildDetailMarkdown(item, "http://127.0.0.1:3210");
    expect(md).toContain("![Preview](http://127.0.0.1:3210/b/thumb123sha)");
    expect(md).toContain("### Test Image Prompt");
    expect(md).toContain("A cute cat");
  });

  it("formats placeholder defaults in detail markdown", () => {
    const item: PromptHubItem = {
      id: "test-id-2",
      title: "Parameterized Prompt",
      content: "Poster with [theme] and [palette]",
      kind: "image",
      placeholders: ["theme", "palette"],
      placeholderDefaults: { theme: "Deep Ocean", palette: "Teal & Gold" },
      tags: [],
      models: [],
      rating: null,
      favorited: false,
      coverSha: null,
      coverThumbSha: null,
      source: { type: "self", url: null, author: null },
      createdAt: "2026-09-23T12:00:00Z",
    };
    const md = buildDetailMarkdown(item, "http://127.0.0.1:3210");
    expect(md).not.toContain("![Preview]");
    expect(md).toContain("- `[theme]` → *Deep Ocean*");
    expect(md).toContain("- `[palette]` → *Teal & Gold*");
  });
});
