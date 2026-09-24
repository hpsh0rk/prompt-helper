/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** PromptHub Server URL - Base URL of PromptHub instance */
  "serverUrl": string,
  /** Personal Access Token (PAT) - Optional PAT for PromptHub remote/cloud instances */
  "apiKey"?: string,
  /** 默认展示视图 - 打开插件时默认呈现的视图：全部提示词 / ⭐ 我的收藏 / 🕒 最近使用 */
  "defaultView": "all" | "favorites" | "recent"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `index` command */
  export type Index = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
}

