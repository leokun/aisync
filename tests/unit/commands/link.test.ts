import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/linker.js", () => ({
  linkProviders: vi.fn(),
}));

vi.mock("../../../src/core/lock.js", () => ({
  readLock: vi.fn(),
  writeLock: vi.fn(),
}));

vi.mock("../../../src/core/scanner.js", () => ({
  scanProviders: vi.fn(),
}));

vi.mock("../../../src/providers/registry.js", () => ({
  filterProviders: vi.fn(),
}));

vi.mock("../../../src/utils/fs.js", () => ({
  exists: vi.fn(),
  isDirectory: vi.fn(),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  setVerbose: vi.fn(),
  header: vi.fn(),
  log: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  item: vi.fn(),
}));

import { link } from "../../../src/commands/link.js";
import { linkProviders } from "../../../src/core/linker.js";
import { readLock, writeLock } from "../../../src/core/lock.js";
import { scanProviders } from "../../../src/core/scanner.js";
import { filterProviders } from "../../../src/providers/registry.js";
import { exists, isDirectory } from "../../../src/utils/fs.js";
import * as log from "../../../src/utils/logger.js";

const mockLinkProviders = vi.mocked(linkProviders);
const mockReadLock = vi.mocked(readLock);
const mockWriteLock = vi.mocked(writeLock);
const mockScanProviders = vi.mocked(scanProviders);
const mockFilterProviders = vi.mocked(filterProviders);
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
  mockLinkProviders.mockResolvedValue({
    linked: [
      {
        path: "CLAUDE.md",
        type: "file",
        provider: "claude",
        target: "../source/CLAUDE.md",
      },
    ],
    skipped: [],
  });
  mockWriteLock.mockResolvedValue(undefined);
}

describe("link command", () => {
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

  describe("argument resolution", () => {
    it("uses sourceArg and destArg when both provided", async () => {
      setupValidSource();

      await link("/src", "/dest", defaultOpts);

      expect(mockScanProviders).toHaveBeenCalled();
      expect(mockLinkProviders).toHaveBeenCalled();
      const linkCall = mockLinkProviders.mock.calls[0];
      expect(linkCall[0]).toContain("src");
      expect(linkCall[1]).toContain("dest");
    });

    it("uses lock source + sourceArg as dest when one arg with lock", async () => {
      setupValidSource();
      mockReadLock.mockResolvedValue({
        version: 1,
        source: "/lock-source",
        lastSync: new Date().toISOString(),
        mode: "link",
        items: [],
      });

      await link("/my-dest", undefined, defaultOpts);

      const linkCall = mockLinkProviders.mock.calls[0];
      expect(linkCall[0]).toBe("/lock-source");
      expect(linkCall[1]).toContain("my-dest");
    });

    it("uses cwd as source + sourceArg as dest when one arg without lock", async () => {
      setupValidSource();
      mockReadLock.mockResolvedValue(null);

      await link("/my-dest", undefined, defaultOpts);

      expect(mockLinkProviders).toHaveBeenCalled();
    });

    it("uses lock source + cwd as dest when no args with lock", async () => {
      setupValidSource();
      mockReadLock.mockResolvedValue({
        version: 1,
        source: "/lock-source",
        lastSync: new Date().toISOString(),
        mode: "link",
        items: [],
      });

      await link(undefined, undefined, defaultOpts);

      const linkCall = mockLinkProviders.mock.calls[0];
      expect(linkCall[0]).toBe("/lock-source");
    });

    it("errors when no args and no lock file", async () => {
      mockReadLock.mockResolvedValue(null);

      await link(undefined, undefined, defaultOpts);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining("No destination specified"),
      );
      expect(process.exitCode).toBe(1);
    });
  });

  describe("validation", () => {
    it("errors when source does not exist", async () => {
      mockExists.mockResolvedValue(false);

      await link("/missing", "/dest", defaultOpts);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining("Source not found"),
      );
      expect(process.exitCode).toBe(1);
    });

    it("errors when source is not a directory", async () => {
      mockExists.mockResolvedValue(true);
      mockIsDirectory.mockResolvedValue(false);

      await link("/file", "/dest", defaultOpts);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining("not a directory"),
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

      await link("/src", "/dest", defaultOpts);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("No providers found"),
      );
      expect(mockLinkProviders).not.toHaveBeenCalled();
    });
  });

  describe("link execution", () => {
    it("calls linkProviders with force and dryRun options", async () => {
      setupValidSource();

      await link("/src", "/dest", {
        ...defaultOpts,
        force: true,
        dryRun: true,
      });

      expect(mockLinkProviders).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        { force: true, dryRun: true },
      );
    });

    it("sets verbose mode from options", async () => {
      setupValidSource();

      await link("/src", "/dest", { ...defaultOpts, verbose: true });

      expect(log.setVerbose).toHaveBeenCalledWith(true);
    });
  });

  describe("dry-run output", () => {
    it("displays Would link and does not call writeLock", async () => {
      setupValidSource();

      await link("/src", "/dest", { ...defaultOpts, dryRun: true });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Would link"),
      );
      expect(mockWriteLock).not.toHaveBeenCalled();
    });
  });

  describe("normal mode", () => {
    it("calls writeLock with mode link when items are linked", async () => {
      setupValidSource();

      await link("/src", "/dest", defaultOpts);

      expect(mockWriteLock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        "link",
      );
      expect(log.success).toHaveBeenCalledWith("1 item(s) linked");
    });

    it("skips writeLock when nothing linked", async () => {
      mockExists.mockResolvedValue(true);
      mockIsDirectory.mockResolvedValue(true);
      mockFilterProviders.mockReturnValue([claude]);
      mockScanProviders.mockResolvedValue([
        { provider: claude, foundPaths: [".claude/"], missingPaths: [] },
      ]);
      mockLinkProviders.mockResolvedValue({
        linked: [],
        skipped: ["CLAUDE.md"],
      });

      await link("/src", "/dest", defaultOpts);

      expect(mockWriteLock).not.toHaveBeenCalled();
    });

    it("displays skipped count when items were skipped", async () => {
      mockExists.mockResolvedValue(true);
      mockIsDirectory.mockResolvedValue(true);
      mockFilterProviders.mockReturnValue([claude]);
      mockScanProviders.mockResolvedValue([
        { provider: claude, foundPaths: [".claude/"], missingPaths: [] },
      ]);
      mockLinkProviders.mockResolvedValue({
        linked: [
          {
            path: ".claude/",
            type: "directory" as const,
            provider: "claude",
            target: "../source/.claude/",
          },
        ],
        skipped: ["CLAUDE.md"],
      });
      mockWriteLock.mockResolvedValue(undefined);

      await link("/src", "/dest", defaultOpts);

      expect(log.warn).toHaveBeenCalledWith("1 item(s) skipped");
    });

    it("warns about symlink source modification when items are linked", async () => {
      setupValidSource();

      await link("/src", "/dest", defaultOpts);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("modify the source directly"),
      );
    });
  });
});
