import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Provider } from "../providers/registry.js";
import { exists } from "../utils/fs.js";
import type { ScanResult } from "./scanner.js";

export interface BootstrapResult {
  generated: { provider: Provider; paths: string[] }[];
}

const templates: Record<
  string,
  (baseFiles: string[]) => Record<string, string>
> = {
  claude: (baseFiles) => ({
    "CLAUDE.md": baseFiles.includes("AGENTS.md")
      ? "# Claude Code\n\n@AGENTS.md\n"
      : "# Claude Code\n",
  }),
  cursor: (baseFiles) => ({
    ".cursorrules": baseFiles.includes("AGENTS.md")
      ? "# Cursor Rules\n\n# See AGENTS.md for shared agent configuration\n"
      : "# Cursor Rules\n",
  }),
  codex: (baseFiles) => ({
    ".codex/instructions.md": baseFiles.includes("AGENTS.md")
      ? "# Codex\n\n# See AGENTS.md for shared agent configuration\n"
      : "# Codex\n",
  }),
  copilot: (baseFiles) => ({
    ".github/copilot/instructions.md": baseFiles.includes("AGENTS.md")
      ? "# Copilot\n\n# See AGENTS.md for shared agent configuration\n"
      : "# Copilot\n",
  }),
};

export async function bootstrap(
  dir: string,
  scanResults: ScanResult[],
): Promise<BootstrapResult> {
  const baseFiles =
    scanResults.find((r) => r.provider.name === "cross-tool")?.foundPaths ?? [];

  const generated: BootstrapResult["generated"] = [];

  for (const result of scanResults) {
    if (result.provider.name === "cross-tool") continue;
    if (result.foundPaths.length > 0) continue;

    const template = templates[result.provider.name];
    if (!template) continue;

    const files = template(baseFiles);
    const paths: string[] = [];

    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = join(dir, relativePath);
      if (await exists(fullPath)) continue;

      await mkdir(join(dir, relativePath, ".."), { recursive: true });
      await writeFile(fullPath, content, "utf-8");
      paths.push(relativePath);
    }

    if (paths.length > 0) {
      generated.push({ provider: result.provider, paths });
    }
  }

  return { generated };
}
