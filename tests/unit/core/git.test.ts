import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:child_process before importing git module
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { getRepoRoot, getWorktrees, isGitRepo } from "../../../src/core/git.js";

const mockExecFile = vi.mocked(execFile);

type ExecCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

function setupExecFile(stdout: string) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    (callback as ExecCallback)(null, stdout, "");
    return {} as ChildProcess;
  });
}

function setupExecFileError(message: string) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    (callback as ExecCallback)(new Error("failed"), "", message);
    return {} as ChildProcess;
  });
}

describe("git", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isGitRepo", () => {
    it("returns true when git succeeds", async () => {
      setupExecFile(".git");
      expect(await isGitRepo("/some/path")).toBe(true);
    });

    it("returns false when git fails", async () => {
      setupExecFileError("not a git repo");
      expect(await isGitRepo("/some/path")).toBe(false);
    });
  });

  describe("getRepoRoot", () => {
    it("returns the resolved path from git output", async () => {
      setupExecFile("/home/user/project");
      const root = await getRepoRoot("/home/user/project/sub");
      expect(root).toContain("home/user/project");
    });
  });

  describe("getWorktrees", () => {
    it("parses a single worktree", async () => {
      setupExecFile("worktree /path/to/main\nbranch refs/heads/main\n");
      const wts = await getWorktrees("/path");
      expect(wts).toHaveLength(1);
      expect(wts[0]).toEqual({
        path: "/path/to/main",
        branch: "main",
        bare: false,
      });
    });

    it("parses multiple worktrees", async () => {
      setupExecFile(
        [
          "worktree /path/to/main",
          "branch refs/heads/main",
          "",
          "worktree /path/to/feature",
          "branch refs/heads/feature",
          "",
        ].join("\n"),
      );
      const wts = await getWorktrees("/path");
      expect(wts).toHaveLength(2);
      expect(wts[0].branch).toBe("main");
      expect(wts[1].branch).toBe("feature");
    });

    it("handles bare worktree", async () => {
      setupExecFile("worktree /path/to/bare\nbare\n");
      const wts = await getWorktrees("/path");
      expect(wts[0]).toEqual({
        path: "/path/to/bare",
        branch: null,
        bare: true,
      });
    });

    it("handles detached HEAD (no branch)", async () => {
      setupExecFile("worktree /path/to/detached\n");
      const wts = await getWorktrees("/path");
      expect(wts[0]).toEqual({
        path: "/path/to/detached",
        branch: null,
        bare: false,
      });
    });

    it("handles output without trailing newline", async () => {
      setupExecFile("worktree /path/to/main\nbranch refs/heads/main");
      const wts = await getWorktrees("/path");
      expect(wts).toHaveLength(1);
      expect(wts[0].branch).toBe("main");
    });

    it("strips refs/heads/ prefix from branch", async () => {
      setupExecFile("worktree /path\nbranch refs/heads/feature/my-branch\n");
      const wts = await getWorktrees("/path");
      expect(wts[0].branch).toBe("feature/my-branch");
    });
  });
});
