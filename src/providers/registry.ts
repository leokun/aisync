import { claude } from "./claude.js";
import { codex } from "./codex.js";
import { copilot } from "./copilot.js";
import { crossTool } from "./cross-tool.js";
import { cursor } from "./cursor.js";

export interface Provider {
  name: string;
  label: string;
  paths: string[];
}

export const providers: Provider[] = [
  claude,
  cursor,
  codex,
  copilot,
  crossTool,
];

export function getProvider(name: string): Provider | undefined {
  return providers.find((p) => p.name === name);
}

export function getProviderNames(): string[] {
  return providers.map((p) => p.name);
}

export function filterProviders(
  only?: string[],
  exclude?: string[],
): Provider[] {
  let result = providers;
  if (only && only.length > 0) {
    result = result.filter((p) => only.includes(p.name));
  }
  if (exclude && exclude.length > 0) {
    result = result.filter((p) => !exclude.includes(p.name));
  }
  return result;
}
