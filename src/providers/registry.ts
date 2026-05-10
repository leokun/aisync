import { aider } from "./aider.js";
import { claude } from "./claude.js";
import { cline } from "./cline.js";
import { codex } from "./codex.js";
import { copilot } from "./copilot.js";
import { crossTool } from "./cross-tool.js";
import { cursor } from "./cursor.js";
import { windsurf } from "./windsurf.js";

export interface Provider {
  name: string;
  label: string;
  paths: string[];
}

export const builtinProviders: Provider[] = [
  claude,
  cursor,
  codex,
  copilot,
  windsurf,
  cline,
  aider,
  crossTool,
];

export const providers: Provider[] = builtinProviders;

export function buildProviders(custom?: Provider[]): Provider[] {
  if (!custom || custom.length === 0) return builtinProviders;
  const result = [...builtinProviders];
  const byName = new Map(result.map((p, i) => [p.name, i]));
  for (const provider of custom) {
    const existing = byName.get(provider.name);
    if (existing !== undefined) {
      result[existing] = provider;
    } else {
      // Insert before cross-tool to keep it last
      const crossToolIndex = result.findIndex((p) => p.name === "cross-tool");
      if (crossToolIndex >= 0) {
        result.splice(crossToolIndex, 0, provider);
      } else {
        result.push(provider);
      }
      byName.set(provider.name, result.length - 1);
    }
  }
  return result;
}

export function getProvider(
  name: string,
  list?: Provider[],
): Provider | undefined {
  return (list ?? builtinProviders).find((p) => p.name === name);
}

export function getProviderNames(list?: Provider[]): string[] {
  return (list ?? builtinProviders).map((p) => p.name);
}

export function filterProviders(
  only?: string[],
  exclude?: string[],
  list?: Provider[],
): Provider[] {
  let result = list ?? builtinProviders;
  if (only && only.length > 0) {
    result = result.filter((p) => only.includes(p.name));
  }
  if (exclude && exclude.length > 0) {
    result = result.filter((p) => !exclude.includes(p.name));
  }
  return result;
}
