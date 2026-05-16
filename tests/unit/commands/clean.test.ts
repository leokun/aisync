import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/cleaner.js", () => ({
  cleanWorktree: vi.fn(),
  CleanError: class CleanError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CleanError";
    }
  },
}));

vi.mock("../../../src/core/git.js", () => ({
  isGitRepo: vi.fn(),
  getWorktrees: vi.fn(),
}));

vi.mock("../../../src/core/lock.js", () => ({
  readLock: vi.fn(),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  setVerbose: vi.fn(),
  setQuiet: vi.fn(),
  header: vi.fn(),
  log: vi.fn(),
  item: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

import { confirm } from "@clack/prompts";
import { clean } from "../../../src/commands/clean.js";
import { cleanWorktree } from "../../../src/core/cleaner.js";
import { getWorktrees, isGitRepo } from "../../../src/core/git.js";
import { readLock } from "../../../src/core/lock.js";
import * as log from "../../../src/utils/logger.js";

const mockClean = vi.mocked(cleanWorktree);
const mockReadLock = vi.mocked(readLock);
const mockIsGitRepo = vi.mocked(isGitRepo);
const mockGetWorktrees = vi.mocked(getWorktrees);
const mockConfirm = vi.mocked(confirm);

describe("clean command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("dry-run skips confirmation and forwards dryRun=true", async () => {
    mockClean.mockResolvedValue({
      destination: "/dest",
      removed: ["config.md"],
      notFound: [],
      lockRemoved: true,
    });
    await clean({ dryRun: true });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockClean).toHaveBeenCalledWith(expect.any(String), {
      dryRun: true,
    });
  });

  it("--force skips confirmation and runs the cleanup", async () => {
    mockClean.mockResolvedValue({
      destination: "/dest",
      removed: ["config.md"],
      notFound: [],
      lockRemoved: true,
    });
    await clean({ force: true });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockClean).toHaveBeenCalledWith(expect.any(String), {
      dryRun: false,
    });
    expect(log.success).toHaveBeenCalled();
  });

  it("--all iterates worktrees that have a lock file", async () => {
    mockIsGitRepo.mockResolvedValue(true);
    mockGetWorktrees.mockResolvedValue([
      { path: "/wt-a", branch: "a", bare: false },
      { path: "/wt-bare", branch: null, bare: true },
      { path: "/wt-b", branch: "b", bare: false },
    ]);
    mockReadLock.mockImplementation(async (dir) => {
      if (dir === "/wt-a" || dir === "/wt-b") {
        return {
          version: 1,
          source: "/src",
          lastSync: "2026-05-10T17:00:00.000Z",
          mode: "copy",
          items: [],
        };
      }
      return null;
    });
    mockClean.mockResolvedValue({
      destination: "/x",
      removed: [],
      notFound: [],
      lockRemoved: true,
    });

    await clean({ all: true, force: true });

    expect(mockClean).toHaveBeenCalledTimes(2);
    expect(mockClean).toHaveBeenCalledWith("/wt-a", { dryRun: false });
    expect(mockClean).toHaveBeenCalledWith("/wt-b", { dryRun: false });
  });

  it("warns when --all finds no lock files", async () => {
    mockIsGitRepo.mockResolvedValue(true);
    mockGetWorktrees.mockResolvedValue([
      { path: "/wt-a", branch: "a", bare: false },
    ]);
    mockReadLock.mockResolvedValue(null);

    await clean({ all: true, force: true });

    expect(log.warn).toHaveBeenCalledWith(
      "No worktree with aisync-lock.json found.",
    );
    expect(mockClean).not.toHaveBeenCalled();
  });

  it("warns and continues when CleanError is thrown", async () => {
    const { CleanError } = await import("../../../src/core/cleaner.js");
    mockClean.mockRejectedValue(new CleanError("nothing here"));
    await clean({ force: true });
    expect(log.warn).toHaveBeenCalledWith("nothing here");
  });
});
