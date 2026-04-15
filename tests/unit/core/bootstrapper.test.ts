import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrap } from "../../../src/core/bootstrapper.js";
import type { ScanResult } from "../../../src/core/scanner.js";
import type { Provider } from "../../../src/providers/registry.js";
import { exists } from "../../../src/utils/fs.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

const claude: Provider = {
  name: "claude",
  label: "Claude Code",
  paths: [".claude/", "CLAUDE.md"],
};
const cursor: Provider = {
  name: "cursor",
  label: "Cursor",
  paths: [".cursor/", ".cursorrules"],
};
const codex: Provider = {
  name: "codex",
  label: "OpenAI Codex",
  paths: [".codex/"],
};
const copilot: Provider = {
  name: "copilot",
  label: "GitHub Copilot",
  paths: [".github/copilot/"],
};
const crossTool: Provider = {
  name: "cross-tool",
  label: "Cross-tool",
  paths: ["AGENTS.md", ".agents/"],
};

function makeScan(provider: Provider, foundPaths: string[]): ScanResult {
  const missingPaths = provider.paths.filter((p) => !foundPaths.includes(p));
  return { provider, foundPaths, missingPaths };
}

describe("bootstrapper", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

  it("generates CLAUDE.md for missing claude provider", async () => {
    const scans = [makeScan(crossTool, []), makeScan(claude, [])];
    const result = await bootstrap(tmp, scans);
    expect(result.generated).toHaveLength(1);
    expect(result.generated[0].paths).toContain("CLAUDE.md");
    expect(await exists(join(tmp, "CLAUDE.md"))).toBe(true);
  });

  it("generates .cursorrules for missing cursor provider", async () => {
    const scans = [makeScan(crossTool, []), makeScan(cursor, [])];
    const result = await bootstrap(tmp, scans);
    expect(result.generated[0].paths).toContain(".cursorrules");
  });

  it("generates .codex/instructions.md for missing codex provider", async () => {
    const scans = [makeScan(crossTool, []), makeScan(codex, [])];
    const result = await bootstrap(tmp, scans);
    expect(result.generated[0].paths).toContain(".codex/instructions.md");
    expect(await exists(join(tmp, ".codex/instructions.md"))).toBe(true);
  });

  it("generates .github/copilot/instructions.md for missing copilot", async () => {
    const scans = [makeScan(crossTool, []), makeScan(copilot, [])];
    const result = await bootstrap(tmp, scans);
    expect(result.generated[0].paths).toContain(
      ".github/copilot/instructions.md",
    );
    expect(await exists(join(tmp, ".github/copilot/instructions.md"))).toBe(
      true,
    );
  });

  it("skips cross-tool provider", async () => {
    const scans = [makeScan(crossTool, [])];
    const result = await bootstrap(tmp, scans);
    expect(result.generated).toHaveLength(0);
  });

  it("skips providers that already have foundPaths", async () => {
    const scans = [makeScan(crossTool, []), makeScan(claude, ["CLAUDE.md"])];
    const result = await bootstrap(tmp, scans);
    expect(result.generated).toHaveLength(0);
  });

  it("references AGENTS.md in content when cross-tool has it", async () => {
    const scans = [makeScan(crossTool, ["AGENTS.md"]), makeScan(claude, [])];
    await bootstrap(tmp, scans);
    const content = await readFile(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("AGENTS.md");
  });

  it("does not reference AGENTS.md when cross-tool lacks it", async () => {
    const scans = [makeScan(crossTool, []), makeScan(claude, [])];
    await bootstrap(tmp, scans);
    const content = await readFile(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).not.toContain("AGENTS.md");
  });

  it("creates parent directories as needed", async () => {
    const scans = [makeScan(crossTool, []), makeScan(copilot, [])];
    await bootstrap(tmp, scans);
    expect(await exists(join(tmp, ".github/copilot/instructions.md"))).toBe(
      true,
    );
  });

  it("does not overwrite files that already exist on disk", async () => {
    await scaffold(tmp, { "CLAUDE.md": "existing content" });
    const scans = [makeScan(crossTool, []), makeScan(claude, [])];
    await bootstrap(tmp, scans);
    const content = await readFile(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toBe("existing content");
  });

  it("returns empty generated when all providers exist", async () => {
    const scans = [
      makeScan(crossTool, ["AGENTS.md"]),
      makeScan(claude, ["CLAUDE.md"]),
      makeScan(cursor, [".cursorrules"]),
    ];
    const result = await bootstrap(tmp, scans);
    expect(result.generated).toHaveLength(0);
  });
});
