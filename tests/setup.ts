import { vi } from "vitest";

vi.mock("@raycast/api", () => {
  return {
    Icon: {
      Image: "image-icon",
      Document: "document-icon",
      Code: "code-icon",
      Video: "video-icon",
      Music: "music-icon",
      Text: "text-icon",
      Warning: "warning-icon",
      MagnifyingGlass: "search-icon",
      Star: "star-icon",
      Clipboard: "clipboard-icon",
      CopyClipboard: "copy-clipboard-icon",
      Window: "window-icon",
      Globe: "globe-icon",
      Link: "link-icon",
      ArrowClockwise: "refresh-icon",
      Gear: "gear-icon",
      Plus: "plus-icon",
      Trash: "trash-icon",
    },
    Alert: {
      ActionStyle: {
        Default: "default",
        Destructive: "destructive",
      },
    },
    confirmAlert: vi.fn(async () => true),
    Color: {
      Red: "red",
      Yellow: "yellow",
      Purple: "purple",
      Blue: "blue",
      Green: "green",
      SecondaryText: "secondaryText",
    },
    getPreferenceValues: () => ({
      serverUrl: "http://127.0.0.1:3210",
      apiKey: "",
    }),
    Clipboard: {
      paste: vi.fn(),
      copy: vi.fn(),
    },
    showToast: vi.fn(),
    showHUD: vi.fn(),
    popToRoot: vi.fn(),
    openExtensionPreferences: vi.fn(),
    LocalStorage: (() => {
      const storage = new Map<string, string>();
      return {
        getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
        setItem: vi.fn(async (key: string, val: string) => {
          storage.set(key, String(val));
        }),
        removeItem: vi.fn(async (key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(async () => {
          storage.clear();
        }),
      };
    })(),
  };
});
