import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/git.js", () => ({
  isGitRepo: vi.fn(),
  getWorktrees: vi.fn(),
}));

vi.mock("../../../src/core/scanner.js", () => ({
  scanProviders: vi.fn(),
}));

vi.mock("../../../src/providers/registry.js", () => ({
  providers: [
    { name: "claude", label: "Claude Code", paths: [".claude/", "CLAUDE.md"] },
    { name: "cursor", label: "Cursor", paths: [".cursor/"] },
  ],
}));

vi.mock("../../../src/utils/logger.js", () => ({
  header: vi.fn(),
  item: vi.fn(),
  error: vi.fn(),
}));

import { listProviders, listWorktrees } from "../../../src/commands/list.js";
import { getWorktrees, isGitRepo } from "../../../src/core/git.js";
import { scanProviders } from "../../../src/core/scanner.js";
import * as log from "../../../src/utils/logger.js";

const mockIsGitRepo = vi.mocked(isGitRepo);
const mockGetWorktrees = vi.mocked(getWorktrees);
const mockScanProviders = vi.mocked(scanProviders);

describe("list commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  describe("listProviders", () => {
    it("displays found providers", async () => {
      mockScanProviders.mockResolvedValue([
        {
          provider: {
            name: "claude",
            label: "Claude Code",
            paths: [".claude/", "CLAUDE.md"],
          },
          foundPaths: [".claude/", "CLAUDE.md"],
          missingPaths: [],
        },
        {
          provider: { name: "cursor", label: "Cursor", paths: [".cursor/"] },
          foundPaths: [],
          missingPaths: [".cursor/"],
        },
      ]);

      await listProviders();

      expect(log.header).toHaveBeenCalledWith("providers");
      expect(log.item).toHaveBeenCalledWith("claude", ".claude/ CLAUDE.md");
      expect(log.item).not.toHaveBeenCalledWith("cursor", expect.anything());
    });

    it("displays (none) when no providers found", async () => {
      mockScanProviders.mockResolvedValue([
        {
          provider: {
            name: "claude",
            label: "Claude Code",
            paths: [".claude/"],
          },
          foundPaths: [],
          missingPaths: [".claude/"],
        },
        {
          provider: { name: "cursor", label: "Cursor", paths: [".cursor/"] },
          foundPaths: [],
          missingPaths: [".cursor/"],
        },
      ]);

      await listProviders();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("(none)"));
    });
  });

  describe("listWorktrees", () => {
    it("errors when not a git repo", async () => {
      mockIsGitRepo.mockResolvedValue(false);

      await listWorktrees();

      expect(log.error).toHaveBeenCalledWith("Not a git repository.");
      expect(process.exitCode).toBe(1);
    });

    it("displays worktrees when in git repo", async () => {
      mockIsGitRepo.mockResolvedValue(true);
      mockGetWorktrees.mockResolvedValue([
        { path: "/path/to/main", branch: "main", bare: false },
        { path: "/path/to/feat", branch: "feature", bare: false },
      ]);

      await listWorktrees();

      expect(log.item).toHaveBeenCalledWith("main", "/path/to/main");
      expect(log.item).toHaveBeenCalledWith("feature", "/path/to/feat");
    });

    it("handles bare worktrees", async () => {
      mockIsGitRepo.mockResolvedValue(true);
      mockGetWorktrees.mockResolvedValue([
        { path: "/path/bare", branch: null, bare: true },
      ]);

      await listWorktrees();

      expect(log.item).toHaveBeenCalledWith("(bare)", "/path/bare");
    });

    it("handles detached HEAD", async () => {
      mockIsGitRepo.mockResolvedValue(true);
      mockGetWorktrees.mockResolvedValue([
        { path: "/path/detached", branch: null, bare: false },
      ]);

      await listWorktrees();

      expect(log.item).toHaveBeenCalledWith("(detached)", "/path/detached");
    });

    it("displays (none) when no worktrees", async () => {
      mockIsGitRepo.mockResolvedValue(true);
      mockGetWorktrees.mockResolvedValue([]);

      await listWorktrees();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("(none)"));
    });
  });
});
