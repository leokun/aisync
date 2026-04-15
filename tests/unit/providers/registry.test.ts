import { describe, expect, it } from "vitest";
import {
  filterProviders,
  getProvider,
  getProviderNames,
  providers,
} from "../../../src/providers/registry.js";

describe("providers registry", () => {
  describe("providers array", () => {
    it("contains 5 providers", () => {
      expect(providers).toHaveLength(5);
    });

    it("each provider has name, label, and non-empty paths", () => {
      for (const p of providers) {
        expect(p.name).toBeTruthy();
        expect(p.label).toBeTruthy();
        expect(p.paths.length).toBeGreaterThan(0);
      }
    });

    it("claude has correct paths", () => {
      const claude = providers.find((p) => p.name === "claude");
      expect(claude?.paths).toEqual([".claude/", "CLAUDE.md"]);
    });

    it("cursor has correct paths", () => {
      const cursor = providers.find((p) => p.name === "cursor");
      expect(cursor?.paths).toEqual([".cursor/", ".cursorrules"]);
    });

    it("codex has correct paths", () => {
      const codex = providers.find((p) => p.name === "codex");
      expect(codex?.paths).toEqual([".codex/"]);
    });

    it("copilot has correct paths", () => {
      const copilot = providers.find((p) => p.name === "copilot");
      expect(copilot?.paths).toEqual([".github/copilot/"]);
    });

    it("cross-tool has correct paths", () => {
      const crossTool = providers.find((p) => p.name === "cross-tool");
      expect(crossTool?.paths).toEqual(["AGENTS.md", ".agents/"]);
    });
  });

  describe("getProvider", () => {
    it("returns the matching provider", () => {
      const p = getProvider("claude");
      expect(p?.name).toBe("claude");
    });

    it("returns undefined for unknown name", () => {
      expect(getProvider("nonexistent")).toBeUndefined();
    });
  });

  describe("getProviderNames", () => {
    it("returns all 5 names", () => {
      const names = getProviderNames();
      expect(names).toHaveLength(5);
      expect(names).toContain("claude");
      expect(names).toContain("cursor");
      expect(names).toContain("codex");
      expect(names).toContain("copilot");
      expect(names).toContain("cross-tool");
    });
  });

  describe("filterProviders", () => {
    it("returns all providers with no args", () => {
      expect(filterProviders()).toHaveLength(5);
    });

    it("filters by only list", () => {
      const result = filterProviders(["claude", "cursor"]);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(["claude", "cursor"]);
    });

    it("excludes by exclude list", () => {
      const result = filterProviders(undefined, ["cross-tool"]);
      expect(result).toHaveLength(4);
      expect(result.map((p) => p.name)).not.toContain("cross-tool");
    });

    it("applies only then exclude", () => {
      const result = filterProviders(["claude", "cursor"], ["claude"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("cursor");
    });

    it("returns empty when only list has no matches", () => {
      const result = filterProviders(["nonexistent"]);
      expect(result).toHaveLength(0);
    });

    it("treats empty only array as no filter", () => {
      const result = filterProviders([]);
      expect(result).toHaveLength(5);
    });
  });
});
