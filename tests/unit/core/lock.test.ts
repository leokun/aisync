import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CopyItem } from "../../../src/core/copier.js";
import type { LinkItem } from "../../../src/core/linker.js";
import { LOCK_FILENAME, readLock, writeLock } from "../../../src/core/lock.js";
import { createTempDir, removeTempDir } from "../../helpers/fixtures.js";

describe("lock", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

  it("LOCK_FILENAME is aisync-lock.json", () => {
    expect(LOCK_FILENAME).toBe("aisync-lock.json");
  });

  describe("readLock", () => {
    it("returns null when no lock file exists", async () => {
      expect(await readLock(tmp)).toBeNull();
    });
  });

  describe("writeLock + readLock round-trip", () => {
    const items: CopyItem[] = [
      {
        path: ".claude/",
        type: "directory",
        provider: "claude",
        hash: "a1b2c3d4",
      },
      { path: "CLAUDE.md", type: "file", provider: "claude", hash: "e5f6a7b8" },
    ];

    it("creates and reads back a lock file", async () => {
      await writeLock(tmp, "/src/path", items);
      const lock = await readLock(tmp);
      expect(lock).not.toBeNull();
    });

    it("has version=1 and mode=copy", async () => {
      await writeLock(tmp, "/src/path", items);
      const lock = await readLock(tmp);
      expect(lock?.version).toBe(1);
      expect(lock?.mode).toBe("copy");
    });

    it("stores the source path", async () => {
      await writeLock(tmp, "/my/source", items);
      const lock = await readLock(tmp);
      expect(lock?.source).toBe("/my/source");
    });

    it("stores items with correct fields", async () => {
      await writeLock(tmp, "/src", items);
      const lock = await readLock(tmp);
      expect(lock?.items).toHaveLength(2);
      expect(lock?.items[0]).toMatchObject({
        path: ".claude/",
        type: "directory",
        provider: "claude",
        hash: "a1b2c3d4",
      });
      expect(lock?.items[1]).toMatchObject({
        path: "CLAUDE.md",
        type: "file",
        provider: "claude",
        hash: "e5f6a7b8",
      });
    });

    it("has valid ISO date strings for lastSync and syncedAt", async () => {
      await writeLock(tmp, "/src", items);
      const lock = await readLock(tmp);
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(lock?.lastSync).toMatch(isoRegex);
      for (const item of lock?.items ?? []) {
        expect(item.syncedAt).toMatch(isoRegex);
      }
    });

    it("overwrites an existing lock file", async () => {
      await writeLock(tmp, "/old", items);
      await writeLock(tmp, "/new", [items[0]]);
      const lock = await readLock(tmp);
      expect(lock?.source).toBe("/new");
      expect(lock?.items).toHaveLength(1);
    });
  });

  describe("writeLock with link mode", () => {
    const linkItems: LinkItem[] = [
      {
        path: ".claude/",
        type: "directory",
        provider: "claude",
        target: "../source/.claude/",
      },
      {
        path: "CLAUDE.md",
        type: "file",
        provider: "claude",
        target: "../source/CLAUDE.md",
      },
    ];

    it("writes mode=link in lock file", async () => {
      await writeLock(tmp, "/src", linkItems, "link");
      const lock = await readLock(tmp);
      expect(lock?.mode).toBe("link");
    });

    it("stores target instead of hash for link items", async () => {
      await writeLock(tmp, "/src", linkItems, "link");
      const lock = await readLock(tmp);
      expect(lock?.items[0].target).toBe("../source/.claude/");
      expect(lock?.items[0].hash).toBeUndefined();
      expect(lock?.items[1].target).toBe("../source/CLAUDE.md");
      expect(lock?.items[1].hash).toBeUndefined();
    });

    it("round-trips link lock file correctly", async () => {
      await writeLock(tmp, "/src", linkItems, "link");
      const lock = await readLock(tmp);
      expect(lock?.version).toBe(1);
      expect(lock?.mode).toBe("link");
      expect(lock?.items).toHaveLength(2);
      expect(lock?.items[0]).toMatchObject({
        path: ".claude/",
        type: "directory",
        provider: "claude",
        target: "../source/.claude/",
      });
    });
  });
});
