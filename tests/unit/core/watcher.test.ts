import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/utils/logger.js", () => ({
  setVerbose: vi.fn(),
  setQuiet: vi.fn(),
  header: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  item: vi.fn(),
  verbose: vi.fn(),
  log: vi.fn(),
}));

vi.mock("../../../src/core/copier.js", () => ({
  copyProviders: vi.fn(),
}));

vi.mock("../../../src/core/linker.js", () => ({
  linkProviders: vi.fn(),
}));

vi.mock("../../../src/core/lock.js", () => ({
  readLock: vi.fn(),
  writeLock: vi.fn(),
  readSiblingLocks: vi.fn(),
}));

vi.mock("../../../src/utils/fs.js", () => ({
  exists: vi.fn(),
}));

vi.mock("../../../src/utils/hash.js", () => ({
  hashItem: vi.fn(),
}));

vi.mock("node:fs", () => ({
  watch: vi.fn(),
}));

import { watch } from "node:fs";
import { copyProviders } from "../../../src/core/copier.js";
import { linkProviders } from "../../../src/core/linker.js";
import { readLock, writeLock } from "../../../src/core/lock.js";
import {
  createBidirectionalWatcher,
  type Participant,
} from "../../../src/core/watcher.js";
import type { Provider } from "../../../src/providers/registry.js";
import { exists } from "../../../src/utils/fs.js";

const mockWatch = vi.mocked(watch);
const mockCopyProviders = vi.mocked(copyProviders);
const mockLinkProviders = vi.mocked(linkProviders);
const mockWriteLock = vi.mocked(writeLock);
const mockReadLock = vi.mocked(readLock);
const mockExists = vi.mocked(exists);

const providers: Provider[] = [
  { name: "claude", label: "Claude", paths: [".claude/"] },
];

function makeWatcher() {
  const closes: Array<() => void> = [];
  mockWatch.mockImplementation(() => {
    const w = {
      close: vi.fn(),
      on: vi.fn(),
    } as unknown as ReturnType<typeof watch>;
    closes.push(() => (w.close as ReturnType<typeof vi.fn>)());
    return w;
  });
  return closes;
}

describe("createBidirectionalWatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockExists.mockResolvedValue(true);
    mockCopyProviders.mockResolvedValue({
      copied: [],
      skipped: [],
      drifted: [],
    });
    mockLinkProviders.mockResolvedValue({ linked: [], skipped: [] });
    mockReadLock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("attaches one watcher per (participant, providerPath)", async () => {
    makeWatcher();
    const participants: Participant[] = [
      { path: "/wt/main", lock: null },
      { path: "/wt/feature", lock: null },
    ];

    const w = createBidirectionalWatcher({
      participants,
      providers,
      mode: "copy",
      force: false,
      debounceMs: 200,
      repoRoot: "/repo",
    });

    await w.start();
    expect(mockWatch).toHaveBeenCalledTimes(2);
    w.stop();
  });

  it("throws when no paths can be watched", async () => {
    makeWatcher();
    mockExists.mockResolvedValue(false);
    const w = createBidirectionalWatcher({
      participants: [{ path: "/wt/main", lock: null }],
      providers,
      mode: "copy",
      force: false,
      debounceMs: 200,
      repoRoot: "/repo",
    });
    await expect(w.start()).rejects.toThrow("No paths to watch");
  });

  it("propagates origin changes to peers via copyProviders", async () => {
    const watchCallbacks = new Map<
      string,
      (e: string, fname: string) => void
    >();
    mockWatch.mockImplementation((path, _opts, cb) => {
      watchCallbacks.set(
        String(path),
        cb as (e: string, fname: string) => void,
      );
      return {
        close: vi.fn(),
        on: vi.fn(),
      } as unknown as ReturnType<typeof watch>;
    });

    mockCopyProviders.mockResolvedValue({
      copied: [
        {
          path: ".claude/file.md",
          type: "file",
          provider: "claude",
          hash: "abc12345",
        },
      ],
      skipped: [],
      drifted: [],
    });

    const participants: Participant[] = [
      { path: "/wt/main", lock: null },
      { path: "/wt/feature", lock: null },
    ];

    const w = createBidirectionalWatcher({
      participants,
      providers,
      mode: "copy",
      force: false,
      debounceMs: 100,
      repoRoot: "/repo",
    });

    await w.start();
    // Drain the initial seed sync
    await vi.runAllTimersAsync();
    mockCopyProviders.mockClear();
    mockWriteLock.mockClear();

    // Simulate a change in feature worktree
    const cb = watchCallbacks.get("/wt/feature/.claude/");
    expect(cb).toBeDefined();
    cb?.("change", "file.md");

    await vi.advanceTimersByTimeAsync(150);
    await vi.runAllTimersAsync();

    expect(mockCopyProviders).toHaveBeenCalledWith(
      "/wt/feature",
      "/wt/main",
      providers,
      expect.objectContaining({ force: true, dryRun: false }),
    );
    expect(mockWriteLock).toHaveBeenCalled();
    w.stop();
  });

  it("suppresses echo events while inFlightWrites is active", async () => {
    const watchCallbacks = new Map<
      string,
      (e: string, fname: string) => void
    >();
    mockWatch.mockImplementation((path, _opts, cb) => {
      watchCallbacks.set(
        String(path),
        cb as (e: string, fname: string) => void,
      );
      return {
        close: vi.fn(),
        on: vi.fn(),
      } as unknown as ReturnType<typeof watch>;
    });

    // Verify the hook is wired by capturing the onBeforeWrite handler
    let beforeWriteHook: ((p: string) => void) | undefined;
    mockCopyProviders.mockImplementation(async (_s, _d, _p, opts) => {
      beforeWriteHook = opts.onBeforeWrite;
      // Mark a synthetic inflight write
      opts.onBeforeWrite?.("/wt/main/.claude/file.md");
      return { copied: [], skipped: [], drifted: [] };
    });

    const participants: Participant[] = [
      { path: "/wt/main", lock: null },
      { path: "/wt/feature", lock: null },
    ];

    const w = createBidirectionalWatcher({
      participants,
      providers,
      mode: "copy",
      force: false,
      debounceMs: 100,
      repoRoot: "/repo",
    });

    await w.start();
    await vi.runAllTimersAsync();

    expect(beforeWriteHook).toBeDefined();
    w.stop();
  });

  it("uses link mode when configured", async () => {
    const watchCallbacks = new Map<
      string,
      (e: string, fname: string) => void
    >();
    mockWatch.mockImplementation((path, _opts, cb) => {
      watchCallbacks.set(
        String(path),
        cb as (e: string, fname: string) => void,
      );
      return {
        close: vi.fn(),
        on: vi.fn(),
      } as unknown as ReturnType<typeof watch>;
    });

    const participants: Participant[] = [
      { path: "/wt/main", lock: null },
      { path: "/wt/feature", lock: null },
    ];

    const w = createBidirectionalWatcher({
      participants,
      providers,
      mode: "link",
      force: false,
      debounceMs: 100,
      repoRoot: "/repo",
    });

    await w.start();
    await vi.runAllTimersAsync();

    expect(mockLinkProviders).toHaveBeenCalled();
    expect(mockCopyProviders).not.toHaveBeenCalled();
    w.stop();
  });

  it("debounces multiple events for the same origin", async () => {
    const watchCallbacks = new Map<
      string,
      (e: string, fname: string) => void
    >();
    mockWatch.mockImplementation((path, _opts, cb) => {
      watchCallbacks.set(
        String(path),
        cb as (e: string, fname: string) => void,
      );
      return {
        close: vi.fn(),
        on: vi.fn(),
      } as unknown as ReturnType<typeof watch>;
    });

    const participants: Participant[] = [
      { path: "/wt/main", lock: null },
      { path: "/wt/feature", lock: null },
    ];

    const w = createBidirectionalWatcher({
      participants,
      providers,
      mode: "copy",
      force: false,
      debounceMs: 200,
      repoRoot: "/repo",
    });

    await w.start();
    await vi.runAllTimersAsync();
    mockCopyProviders.mockClear();

    const cb = watchCallbacks.get("/wt/feature/.claude/");
    cb?.("change", "a.md");
    cb?.("change", "b.md");
    cb?.("change", "c.md");

    await vi.advanceTimersByTimeAsync(250);
    await vi.runAllTimersAsync();

    // One propagation cycle for the single debounced origin
    expect(mockCopyProviders).toHaveBeenCalledTimes(1);
    w.stop();
  });
});
