/** chrome.storage-backed configuration for the LiteLLM endpoint (options page only). */

import { isConfigured, type LlmConfig } from "./llm.js";

export type { LlmConfig };

const STORAGE_KEY = "fineprint_config";

export const CONFIG_DEFAULTS: LlmConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.2,
};

function sanitize(value: unknown): LlmConfig {
  if (typeof value !== "object" || value === null) return { ...CONFIG_DEFAULTS };
  const record = value as Partial<LlmConfig>;
  const temperature = typeof record.temperature === "number" ? record.temperature : CONFIG_DEFAULTS.temperature;
  return {
    baseUrl: typeof record.baseUrl === "string" ? record.baseUrl : CONFIG_DEFAULTS.baseUrl,
    apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
    model: typeof record.model === "string" ? record.model : CONFIG_DEFAULTS.model,
    temperature: Number.isFinite(temperature) ? temperature : CONFIG_DEFAULTS.temperature,
  };
}

export async function loadConfig(): Promise<LlmConfig> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return sanitize(stored[STORAGE_KEY]);
}

export async function saveConfig(config: LlmConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: sanitize(config) });
}

export { isConfigured };
