import { resolve } from "node:path";
import type { Provider } from "../providers/registry.js";
import { exists, readJson } from "../utils/fs.js";
import * as log from "../utils/logger.js";

export const CONFIG_FILE = ".aisyncrc";

export interface AisyncConfig {
  source?: string;
  only?: string[];
  exclude?: string[];
  providers?: Provider[];
  templates?: Record<string, Record<string, string>>;
}

export async function readConfig(
  dir: string = ".",
): Promise<AisyncConfig | null> {
  const path = resolve(dir, CONFIG_FILE);
  if (!(await exists(path))) return null;

  try {
    const raw = await readJson<unknown>(path);
    return validateConfig(raw, path);
  } catch (err) {
    log.error(
      `Failed to parse ${CONFIG_FILE}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
    return null;
  }
}

function validateConfig(raw: unknown, path: string): AisyncConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  const obj = raw as Record<string, unknown>;
  const config: AisyncConfig = {};

  if (obj.source !== undefined) {
    if (typeof obj.source !== "string") {
      throw new Error(`"source" must be a string`);
    }
    config.source = obj.source;
  }

  if (obj.only !== undefined) {
    config.only = asStringArray(obj.only, "only");
  }

  if (obj.exclude !== undefined) {
    config.exclude = asStringArray(obj.exclude, "exclude");
  }

  if (obj.providers !== undefined) {
    if (!Array.isArray(obj.providers)) {
      throw new Error(`"providers" must be an array`);
    }
    config.providers = obj.providers.map((p, i) => validateProvider(p, i));
  }

  if (obj.templates !== undefined) {
    if (
      typeof obj.templates !== "object" ||
      obj.templates === null ||
      Array.isArray(obj.templates)
    ) {
      throw new Error(`"templates" must be an object`);
    }
    const templates: Record<string, Record<string, string>> = {};
    for (const [name, files] of Object.entries(
      obj.templates as Record<string, unknown>,
    )) {
      if (typeof files !== "object" || files === null || Array.isArray(files)) {
        throw new Error(`"templates.${name}" must be an object`);
      }
      const fileMap: Record<string, string> = {};
      for (const [filePath, content] of Object.entries(
        files as Record<string, unknown>,
      )) {
        if (typeof content !== "string") {
          throw new Error(`"templates.${name}.${filePath}" must be a string`);
        }
        fileMap[filePath] = content;
      }
      templates[name] = fileMap;
    }
    config.templates = templates;
  }

  return config;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error(`"${field}" must be an array of strings`);
  }
  return value as string[];
}

function validateProvider(raw: unknown, index: number): Provider {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`"providers[${index}]" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    throw new Error(`"providers[${index}].name" must be a non-empty string`);
  }
  if (typeof obj.label !== "string" || obj.label.length === 0) {
    throw new Error(`"providers[${index}].label" must be a non-empty string`);
  }
  if (
    !Array.isArray(obj.paths) ||
    obj.paths.some((p) => typeof p !== "string")
  ) {
    throw new Error(`"providers[${index}].paths" must be an array of strings`);
  }
  return {
    name: obj.name,
    label: obj.label,
    paths: obj.paths as string[],
  };
}
