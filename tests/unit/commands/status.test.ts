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
  ],
}));

vi.mock("../../../src/utils/logger.js", () => ({
  header: vi.fn(),
  item: vi.fn(),
}));

import { status } from "../../../src/commands/status.js";
import { getWorktrees, isGitRepo } from "../../../src/core/git.js";
import { scanProviders } from "../../../src/core/scanner.js";
import * as log from "../../../src/utils/logger.js";

const mockIsGitRepo = vi.mocked(isGitRepo);
const mockGetWorktrees = vi.mocked(getWorktrees);
const mockScanProviders = vi.mocked(scanProviders);

describe("status command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("displays detected providers", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: {
          name: "claude",
          label: "Claude Code",
          paths: [".claude/", "CLAUDE.md"],
        },
        foundPaths: [".claude/"],
        missingPaths: ["CLAUDE.md"],
      },
    ]);
    mockIsGitRepo.mockResolvedValue(false);

    await status();

    expect(log.header).toHaveBeenCalledWith("status");
    expect(log.item).toHaveBeenCalledWith("claude", ".claude/");
  });

  it("displays (none) when no providers found", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [],
        missingPaths: [".claude/"],
      },
    ]);
    mockIsGitRepo.mockResolvedValue(false);

    await status();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("(none)"));
  });

  it("displays worktrees when in a git repo", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [],
        missingPaths: [".claude/"],
      },
    ]);
    mockIsGitRepo.mockResolvedValue(true);
    mockGetWorktrees.mockResolvedValue([
      { path: "/path/main", branch: "main", bare: false },
    ]);

    await status();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Git worktrees:"),
    );
    expect(log.item).toHaveBeenCalledWith("main", "/path/main");
  });

  it("displays 'Not a git repository' when not in git repo", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [],
        missingPaths: [".claude/"],
      },
    ]);
    mockIsGitRepo.mockResolvedValue(false);

    await status();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Not a git repository"),
    );
  });

  it("handles bare and detached worktrees", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [],
        missingPaths: [".claude/"],
      },
    ]);
    mockIsGitRepo.mockResolvedValue(true);
    mockGetWorktrees.mockResolvedValue([
      { path: "/bare", branch: null, bare: true },
      { path: "/detached", branch: null, bare: false },
    ]);

    await status();

    expect(log.item).toHaveBeenCalledWith("(bare)", "/bare");
    expect(log.item).toHaveBeenCalledWith("(detached)", "/detached");
  });

  it("displays (none) when no worktrees", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [],
        missingPaths: [".claude/"],
      },
    ]);
    mockIsGitRepo.mockResolvedValue(true);
    mockGetWorktrees.mockResolvedValue([]);

    await status();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("(none)"));
  });
});
