import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/git.js", () => ({
  isGitRepo: vi.fn(),
  getRepoRoot: vi.fn(),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  header: vi.fn(),
  log: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setVerbose: vi.fn(),
  setQuiet: vi.fn(),
}));

import { hookInstall, hookRemove } from "../../../src/commands/hook.js";
import { getRepoRoot, isGitRepo } from "../../../src/core/git.js";
import * as log from "../../../src/utils/logger.js";

const mockIsGitRepo = vi.mocked(isGitRepo);
const mockGetRepoRoot = vi.mocked(getRepoRoot);

describe("hook commands", () => {
  let tmpDir: string;
  let hookPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), "aisync-hook-"));
    await mkdir(join(tmpDir, ".git", "hooks"), { recursive: true });
    hookPath = join(tmpDir, ".git", "hooks", "post-checkout");
    mockIsGitRepo.mockResolvedValue(true);
    mockGetRepoRoot.mockResolvedValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("hookInstall", () => {
    it("errors when not a git repo", async () => {
      mockIsGitRepo.mockResolvedValue(false);
      await hookInstall(tmpDir);
      expect(log.error).toHaveBeenCalledWith("Not a git repository.");
      expect(process.exitCode).toBe(1);
    });

    it("creates a hook file with shebang and aisync block", async () => {
      await hookInstall(tmpDir);
      const content = await readFile(hookPath, "utf-8");
      expect(content.startsWith("#!/bin/sh")).toBe(true);
      expect(content).toContain("# >>> aisync hook >>>");
      expect(content).toContain("aisync copy");
      expect(content).toContain("# <<< aisync hook <<<");
    });

    it("makes the hook executable", async () => {
      await hookInstall(tmpDir);
      const s = await stat(hookPath);
      expect(s.mode & 0o111).not.toBe(0);
    });

    it("preserves existing hook content when appending", async () => {
      await writeFile(hookPath, "#!/bin/sh\necho 'custom logic'\n", {
        mode: 0o755,
      });
      await hookInstall(tmpDir);
      const content = await readFile(hookPath, "utf-8");
      expect(content).toContain("echo 'custom logic'");
      expect(content).toContain("# >>> aisync hook >>>");
    });

    it("replaces existing aisync block on reinstall", async () => {
      await hookInstall(tmpDir);
      await hookInstall(tmpDir);
      const content = await readFile(hookPath, "utf-8");
      const startMatches = content.match(/# >>> aisync hook >>>/g);
      expect(startMatches).toHaveLength(1);
    });
  });

  describe("hookRemove", () => {
    it("errors when not a git repo", async () => {
      mockIsGitRepo.mockResolvedValue(false);
      await hookRemove(tmpDir);
      expect(log.error).toHaveBeenCalledWith("Not a git repository.");
      expect(process.exitCode).toBe(1);
    });

    it("warns when hook file does not exist", async () => {
      await hookRemove(tmpDir);
      expect(log.warn).toHaveBeenCalledWith("No post-checkout hook found.");
    });

    it("warns when hook exists without aisync block", async () => {
      await writeFile(hookPath, "#!/bin/sh\necho hi\n", { mode: 0o755 });
      await hookRemove(tmpDir);
      expect(log.warn).toHaveBeenCalledWith(
        "aisync block not found in post-checkout hook; nothing to remove.",
      );
    });

    it("deletes the hook file when only aisync block remains", async () => {
      await hookInstall(tmpDir);
      await hookRemove(tmpDir);
      await expect(stat(hookPath)).rejects.toThrow();
    });

    it("preserves other content and removes only the aisync block", async () => {
      await writeFile(hookPath, "#!/bin/sh\necho 'custom logic'\n", {
        mode: 0o755,
      });
      await hookInstall(tmpDir);
      await hookRemove(tmpDir);
      const content = await readFile(hookPath, "utf-8");
      expect(content).toContain("echo 'custom logic'");
      expect(content).not.toContain("# >>> aisync hook >>>");
    });
  });
});
