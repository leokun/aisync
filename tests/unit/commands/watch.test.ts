import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/git.js", () => ({
  isGitRepo: vi.fn(),
  getRepoRoot: vi.fn(),
  getWorktrees: vi.fn(),
}));

vi.mock("../../../src/core/scanner.js", () => ({
  scanProviders: vi.fn(),
}));

vi.mock("../../../src/core/config.js", () => ({
  readConfig: vi.fn(async () => null),
}));

vi.mock("../../../src/utils/fs.js", () => ({
  exists: vi.fn(),
}));

vi.mock("../../../src/providers/registry.js", () => ({
  buildProviders: vi.fn(() => [
    { name: "claude", label: "Claude Code", paths: [".claude/"] },
  ]),
  filterProviders: vi.fn((_only, _exclude, list) => list),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  setVerbose: vi.fn(),
  header: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  item: vi.fn(),
  verbose: vi.fn(),
  log: vi.fn(),
}));

import { watchCommand } from "../../../src/commands/watch.js";
import { isGitRepo } from "../../../src/core/git.js";
import { scanProviders } from "../../../src/core/scanner.js";
import { exists } from "../../../src/utils/fs.js";
import * as log from "../../../src/utils/logger.js";

const mockExists = vi.mocked(exists);
const mockIsGitRepo = vi.mocked(isGitRepo);
const mockScanProviders = vi.mocked(scanProviders);

describe("watch command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("errors when source does not exist", async () => {
    mockExists.mockResolvedValue(false);
    await watchCommand("/missing", {
      link: false,
      force: false,
      verbose: false,
      debounce: "200",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Source not found"),
    );
    expect(process.exitCode).toBe(1);
  });

  it("errors when source is not a git repo", async () => {
    mockExists.mockResolvedValue(true);
    mockIsGitRepo.mockResolvedValue(false);
    await watchCommand("/some/path", {
      link: false,
      force: false,
      verbose: false,
      debounce: "200",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("not a git repository"),
    );
    expect(process.exitCode).toBe(1);
  });

  it("warns and exits when no providers are detected", async () => {
    mockExists.mockResolvedValue(true);
    mockIsGitRepo.mockResolvedValue(true);
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [],
        missingPaths: [".claude/"],
      },
    ]);
    await watchCommand("/some/path", {
      link: false,
      force: false,
      verbose: false,
      debounce: "200",
    });
    expect(log.warn).toHaveBeenCalledWith(
      "No providers found in source directory.",
    );
  });

  it("rejects an invalid debounce value", async () => {
    mockExists.mockResolvedValue(true);
    mockIsGitRepo.mockResolvedValue(true);
    mockScanProviders.mockResolvedValue([
      {
        provider: { name: "claude", label: "Claude Code", paths: [".claude/"] },
        foundPaths: [".claude/"],
        missingPaths: [],
      },
    ]);
    await watchCommand("/some/path", {
      link: false,
      force: false,
      verbose: false,
      debounce: "abc",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid --debounce value"),
    );
    expect(process.exitCode).toBe(1);
  });
});
