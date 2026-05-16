import { resolve } from "node:path";
import { bootstrap } from "../core/bootstrapper.js";
import { readConfig } from "../core/config.js";
import { scanProviders } from "../core/scanner.js";
import { buildProviders, filterProviders } from "../providers/registry.js";
import * as log from "../utils/logger.js";
import { isTTY } from "../utils/platform.js";
import { selectProviders } from "../utils/prompt.js";

interface InitOptions {
  only?: string[];
  interactive?: boolean;
  quiet?: boolean;
}

export async function init(options: InitOptions): Promise<void> {
  log.setQuiet(options.quiet ?? false);
  const dir = resolve(".");
  const config = await readConfig(dir);
  const registry = buildProviders(config?.providers);

  const only = options.only ?? config?.only;
  let providers = filterProviders(only, undefined, registry);

  const noFilter = !only?.length;
  const wantsInteractive = options.interactive || (noFilter && isTTY());
  if (wantsInteractive) {
    const selectable = providers.filter((p) => p.name !== "cross-tool");
    if (selectable.length > 1) {
      const picked = await selectProviders(selectable);
      const pickedNames = new Set(picked.map((p) => p.name));
      providers = providers.filter(
        (p) => p.name === "cross-tool" || pickedNames.has(p.name),
      );
    }
  }

  const scanResults = await scanProviders(dir, providers);

  log.header("init");

  // Show cross-tool base
  const crossToolResult = scanResults.find(
    (r) => r.provider.name === "cross-tool",
  );
  if (crossToolResult) {
    log.log("  Detected base:");
    for (const p of crossToolResult.foundPaths) {
      log.item(p, "✓");
    }
    if (crossToolResult.foundPaths.length === 0) {
      log.log("    (none)");
    }
    log.log("");
  }

  // Show detected providers
  log.log("  Detected providers:");
  for (const result of scanResults) {
    if (result.provider.name === "cross-tool") continue;
    if (result.foundPaths.length > 0) {
      log.item(result.provider.name, `${result.foundPaths.join(" ")} (exists)`);
    } else {
      log.item(result.provider.name, "not found");
    }
  }
  log.log("");

  // Bootstrap missing providers
  const result = await bootstrap(dir, scanResults, {
    templates: config?.templates,
  });

  if (result.generated.length === 0) {
    log.log("  Nothing to generate - all providers already configured.");
  } else {
    log.log("  Generated:");
    for (const entry of result.generated) {
      for (const path of entry.paths) {
        log.item(path, `references base config`);
      }
    }
    log.log("");
    log.success(
      `${result.generated.reduce((acc, e) => acc + e.paths.length, 0)} provider config(s) generated.`,
    );
  }

  log.log("");
  log.log("  Done!");
  log.log("");
}
