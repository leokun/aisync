import { resolve } from "node:path";
import { bootstrap } from "../core/bootstrapper.js";
import { scanProviders } from "../core/scanner.js";
import { filterProviders } from "../providers/registry.js";
import * as log from "../utils/logger.js";

interface InitOptions {
  only?: string[];
}

export async function init(options: InitOptions): Promise<void> {
  const dir = resolve(".");
  const providers = filterProviders(options.only);
  const scanResults = await scanProviders(dir, providers);

  log.header("init");

  // Show cross-tool base
  const crossToolResult = scanResults.find(
    (r) => r.provider.name === "cross-tool",
  );
  if (crossToolResult) {
    console.log("  Detected base:");
    for (const p of crossToolResult.foundPaths) {
      log.item(p, "✓");
    }
    if (crossToolResult.foundPaths.length === 0) {
      console.log("    (none)");
    }
    console.log();
  }

  // Show detected providers
  console.log("  Detected providers:");
  for (const result of scanResults) {
    if (result.provider.name === "cross-tool") continue;
    if (result.foundPaths.length > 0) {
      log.item(result.provider.name, `${result.foundPaths.join(" ")} (exists)`);
    } else {
      log.item(result.provider.name, "not found");
    }
  }
  console.log();

  // Bootstrap missing providers
  const result = await bootstrap(dir, scanResults);

  if (result.generated.length === 0) {
    console.log("  Nothing to generate - all providers already configured.");
  } else {
    console.log("  Generated:");
    for (const entry of result.generated) {
      for (const path of entry.paths) {
        log.item(path, `references base config`);
      }
    }
    console.log();
    log.success(
      `${result.generated.reduce((acc, e) => acc + e.paths.length, 0)} provider config(s) generated.`,
    );
  }

  console.log();
  console.log("  Done!");
  console.log();
}
