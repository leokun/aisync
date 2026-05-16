import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/copier.js", () => ({
  copyProviders: vi.fn(),
}));

vi.mock("../../../src/core/lock.js", () => ({
  readLock: vi.fn(),
  writeLock: vi.fn(),
}));

vi.mock("../../../src/core/scanner.js", () => ({
  scanProviders: vi.fn(),
}));

vi.mock("../../../src/core/git.js", () => ({
  findCandidateSources: vi.fn(),
}));

vi.mock("../../../src/providers/registry.js", () => ({
  filterProviders: vi.fn(),
  buildProviders: vi.fn(() => []),
}));

vi.mock("../../../src/core/config.js", () => ({
  readConfig: vi.fn(async () => null),
}));

vi.mock("../../../src/utils/fs.js", () => ({
  exists: vi.fn(),
  isDirectory: vi.fn(),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  setVerbose: vi.fn(),
  setQuiet: vi.fn(),
  header: vi.fn(),
  log: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  item: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

import { pull } from "../../../src/commands/pull.js";
import { copyProviders } from "../../../src/core/copier.js";
import { findCandidateSources } from "../../../src/core/git.js";
import { readLock, writeLock } from "../../../src/core/lock.js";
import { scanProviders } from "../../../src/core/scanner.js";
import { filterProviders } from "../../../src/providers/registry.js";
import { exists, isDirectory } from "../../../src/utils/fs.js";
import * as log from "../../../src/utils/logger.js";

const mockCopyProviders = vi.mocked(copyProviders);
const mockReadLock = vi.mocked(readLock);
const mockWriteLock = vi.mocked(writeLock);
const mockScanProviders = vi.mocked(scanProviders);
const mockFilterProviders = vi.mocked(filterProviders);
const mockFindCandidateSources = vi.mocked(findCandidateSources);
const mockExists = vi.mocked(exists);
const mockIsDirectory = vi.mocked(isDirectory);

const claude = {
  name: "claude",
  label: "Claude Code",
  paths: [".claude/", "CLAUDE.md"],
};

const defaultOpts = { dryRun: false, force: false, verbose: false };

function setupValidSource() {
  mockExists.mockResolvedValue(true);
  mockIsDirectory.mockResolvedValue(true);
  mockFilterProviders.mockReturnValue([claude]);
  mockScanProviders.mockResolvedValue([
    {
      provider: claude,
      foundPaths: [".claude/", "CLAUDE.md"],
      missingPaths: [],
    },
  ]);
  mockCopyProviders.mockResolvedValue({
    copied: [
      { path: "CLAUDE.md", type: "file", provider: "claude", hash: "abcd1234" },
    ],
    skipped: [],
  });
  mockWriteLock.mockResolvedValue(undefined);
}

describe("pull command", () => {
  const logSpy = vi.mocked(log.log);
  let originalStdinTTY: boolean | undefined;
  let originalStdoutTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    originalStdinTTY = process.stdin.isTTY;
    originalStdoutTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalStdinTTY,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalStdoutTTY,
      configurable: true,
    });
  });

  function setTTY(enabled: boolean): void {
    Object.defineProperty(process.stdin, "isTTY", {
      value: enabled,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: enabled,
      configurable: true,
    });
  }

  describe("source resolution", () => {
    it("uses explicit sourceArg when provided", async () => {
      setupValidSource();

      await pull("/explicit-src", defaultOpts);

      const copyCall = mockCopyProviders.mock.calls[0];
      expect(copyCall[0]).toContain("explicit-src");
      const lockCall = mockWriteLock.mock.calls[0];
      expect(lockCall[1]).toContain("explicit-src");
    });

    it("uses lock.source when no sourceArg but lock present", async () => {
      setupValidSource();
      mockReadLock.mockResolvedValue({
        version: 1,
        source: "/lock-source",
        lastSync: new Date().toISOString(),
        mode: "copy",
        items: [],
      });

      await pull(undefined, defaultOpts);

      const copyCall = mockCopyProviders.mock.calls[0];
      expect(copyCall[0]).toBe("/lock-source");
    });

    it("auto-picks single candidate when no sourceArg and no lock", async () => {
      setupValidSource();
      mockReadLock.mockResolvedValue(null);
      mockFindCandidateSources.mockResolvedValue([
        { path: "/repo/main", branch: "main", bare: false },
      ]);

      await pull(undefined, defaultOpts);

      const copyCall = mockCopyProviders.mock.calls[0];
      expect(copyCall[0]).toContain("/repo/main");
    });

    it("errors when no sourceArg, no lock, and zero candidates", async () => {
      mockReadLock.mockResolvedValue(null);
      mockFindCandidateSources.mockResolvedValue([]);

      await pull(undefined, defaultOpts);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining("no other worktrees"),
      );
      expect(process.exitCode).toBe(1);
      expect(mockCopyProviders).not.toHaveBeenCalled();
    });

    it("errors when multiple candidates and not a TTY", async () => {
      setTTY(false);
      mockReadLock.mockResolvedValue(null);
      mockFindCandidateSources.mockResolvedValue([
        { path: "/repo/main", branch: "main", bare: false },
        { path: "/repo/feature", branch: "feature", bare: false },
      ]);

      await pull(undefined, defaultOpts);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining("Multiple candidate sources"),
      );
      expect(process.exitCode).toBe(1);
      expect(mockCopyProviders).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("errors when source does not exist", async () => {
      mockExists.mockResolvedValue(false);

      await pull("/missing", defaultOpts);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining("Source not found"),
      );
      expect(process.exitCode).toBe(1);
    });

    it("warns when no active providers found", async () => {
      mockExists.mockResolvedValue(true);
      mockIsDirectory.mockResolvedValue(true);
      mockFilterProviders.mockReturnValue([claude]);
      mockScanProviders.mockResolvedValue([
        {
          provider: claude,
          foundPaths: [],
          missingPaths: [".claude/", "CLAUDE.md"],
        },
      ]);

      await pull("/src", defaultOpts);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("No providers found"),
      );
      expect(mockCopyProviders).not.toHaveBeenCalled();
    });
  });

  describe("dry-run", () => {
    it("does not call writeLock in dry-run mode", async () => {
      setupValidSource();

      await pull("/src", { ...defaultOpts, dryRun: true });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Would copy"),
      );
      expect(mockWriteLock).not.toHaveBeenCalled();
    });
  });

  describe("normal mode", () => {
    it("writes lock with source pointing at resolved source", async () => {
      setupValidSource();

      await pull("/my-source", defaultOpts);

      expect(mockWriteLock).toHaveBeenCalled();
      const lockCall = mockWriteLock.mock.calls[0];
      expect(lockCall[1]).toContain("my-source");
      expect(lockCall[3]).toBe("copy");
    });

    it("passes --only and --exclude through to filterProviders", async () => {
      setupValidSource();

      await pull("/src", {
        ...defaultOpts,
        only: ["claude"],
        exclude: ["cursor"],
      });

      expect(mockFilterProviders).toHaveBeenCalledWith(
        ["claude"],
        ["cursor"],
        expect.any(Array),
      );
    });
  });
});
