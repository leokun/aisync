import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasAnyProvider, scanProviders } from "../../../src/core/scanner.js";
import type { Provider } from "../../../src/providers/registry.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("scanner", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

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

  describe("scanProviders", () => {
    it("returns empty foundPaths when no files exist", async () => {
      const results = await scanProviders(tmp, [claude]);
      expect(results[0].foundPaths).toEqual([]);
      expect(results[0].missingPaths).toEqual([".claude/", "CLAUDE.md"]);
    });

    it("detects an existing file", async () => {
      await scaffold(tmp, { "CLAUDE.md": "# Claude" });
      const results = await scanProviders(tmp, [claude]);
      expect(results[0].foundPaths).toContain("CLAUDE.md");
      expect(results[0].missingPaths).toContain(".claude/");
    });

    it("detects an existing directory", async () => {
      await scaffold(tmp, { ".claude/settings.json": "{}" });
      const results = await scanProviders(tmp, [claude]);
      expect(results[0].foundPaths).toContain(".claude/");
    });

    it("separates found vs missing paths correctly", async () => {
      await scaffold(tmp, { "CLAUDE.md": "# hi" });
      const results = await scanProviders(tmp, [claude]);
      expect(results[0].foundPaths).toEqual(["CLAUDE.md"]);
      expect(results[0].missingPaths).toEqual([".claude/"]);
    });

    it("works with multiple providers", async () => {
      await scaffold(tmp, { "CLAUDE.md": "x", ".cursorrules": "y" });
      const results = await scanProviders(tmp, [claude, cursor]);
      expect(results).toHaveLength(2);
      expect(results[0].foundPaths).toEqual(["CLAUDE.md"]);
      expect(results[1].foundPaths).toEqual([".cursorrules"]);
    });

    it("returns provider reference in results", async () => {
      const results = await scanProviders(tmp, [claude]);
      expect(results[0].provider).toBe(claude);
    });
  });

  describe("hasAnyProvider", () => {
    it("returns false when all results have empty foundPaths", () => {
      expect(
        hasAnyProvider([
          { provider: claude, foundPaths: [], missingPaths: [".claude/"] },
        ]),
      ).toBe(false);
    });

    it("returns true when at least one path is found", () => {
      expect(
        hasAnyProvider([
          { provider: claude, foundPaths: ["CLAUDE.md"], missingPaths: [] },
        ]),
      ).toBe(true);
    });
  });
});
