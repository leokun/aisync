import { describe, expect, it } from "vitest";
import {
  buildProviders,
  filterProviders,
  getProvider,
  getProviderNames,
  providers,
} from "../../../src/providers/registry.js";

describe("providers registry", () => {
  describe("providers array", () => {
    it("contains 8 providers", () => {
      expect(providers).toHaveLength(8);
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

    it("windsurf has correct paths", () => {
      const windsurf = providers.find((p) => p.name === "windsurf");
      expect(windsurf?.paths).toEqual([".windsurf/", ".windsurfrules"]);
    });

    it("cline has correct paths", () => {
      const cline = providers.find((p) => p.name === "cline");
      expect(cline?.paths).toEqual([".clinerules"]);
    });

    it("aider has correct paths", () => {
      const aider = providers.find((p) => p.name === "aider");
      expect(aider?.paths).toEqual([".aider.conf.yml", "CONVENTIONS.md"]);
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
    it("returns all 8 names", () => {
      const names = getProviderNames();
      expect(names).toHaveLength(8);
      expect(names).toContain("claude");
      expect(names).toContain("cursor");
      expect(names).toContain("codex");
      expect(names).toContain("copilot");
      expect(names).toContain("windsurf");
      expect(names).toContain("cline");
      expect(names).toContain("aider");
      expect(names).toContain("cross-tool");
    });
  });

  describe("filterProviders", () => {
    it("returns all providers with no args", () => {
      expect(filterProviders()).toHaveLength(8);
    });

    it("filters by only list", () => {
      const result = filterProviders(["claude", "cursor"]);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(["claude", "cursor"]);
    });

    it("excludes by exclude list", () => {
      const result = filterProviders(undefined, ["cross-tool"]);
      expect(result).toHaveLength(7);
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
      expect(result).toHaveLength(8);
    });

    it("filters within a custom registry", () => {
      const custom = buildProviders([
        { name: "my-tool", label: "My Tool", paths: [".mytool/"] },
      ]);
      const result = filterProviders(["my-tool"], undefined, custom);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("my-tool");
    });
  });

  describe("buildProviders", () => {
    it("returns builtin providers when no custom is given", () => {
      const result = buildProviders();
      expect(result).toHaveLength(8);
    });

    it("appends a new custom provider before cross-tool", () => {
      const result = buildProviders([
        { name: "my-tool", label: "My Tool", paths: [".mytool/"] },
      ]);
      expect(result).toHaveLength(9);
      const names = result.map((p) => p.name);
      expect(names).toContain("my-tool");
      expect(names[names.length - 1]).toBe("cross-tool");
    });

    it("overrides a builtin provider with same name", () => {
      const result = buildProviders([
        { name: "claude", label: "My Claude", paths: [".custom-claude/"] },
      ]);
      expect(result).toHaveLength(8);
      const claude = result.find((p) => p.name === "claude");
      expect(claude?.label).toBe("My Claude");
      expect(claude?.paths).toEqual([".custom-claude/"]);
    });
  });
});
