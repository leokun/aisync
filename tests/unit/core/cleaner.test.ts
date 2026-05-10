import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CleanError, cleanWorktree } from "../../../src/core/cleaner.js";
import { copyProviders } from "../../../src/core/copier.js";
import { LOCK_FILENAME, writeLock } from "../../../src/core/lock.js";
import type { Provider } from "../../../src/providers/registry.js";
import { exists } from "../../../src/utils/fs.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("cleaner", () => {
  let src: string;
  let dest: string;

  const provider: Provider = {
    name: "test",
    label: "Test",
    paths: ["config.md", "config/"],
  };

  beforeEach(async () => {
    src = await createTempDir();
    dest = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(src);
    await removeTempDir(dest);
  });

  async function syncCopy(): Promise<void> {
    const result = await copyProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    await writeLock(dest, src, result.copied, "copy");
  }

  it("throws CleanError when no lock file exists", async () => {
    await expect(cleanWorktree(dest, { dryRun: false })).rejects.toBeInstanceOf(
      CleanError,
    );
  });

  it("removes synced items and the lock file", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();

    const result = await cleanWorktree(dest, { dryRun: false });

    expect(result.removed).toEqual(["config.md", "config/"]);
    expect(result.lockRemoved).toBe(true);
    expect(await exists(join(dest, "config.md"))).toBe(false);
    expect(await exists(join(dest, "config/"))).toBe(false);
    expect(await exists(join(dest, LOCK_FILENAME))).toBe(false);
  });

  it("dry-run reports items but removes nothing", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();

    const result = await cleanWorktree(dest, { dryRun: true });

    expect(result.removed).toEqual(["config.md", "config/"]);
    expect(result.lockRemoved).toBe(true);
    expect(await exists(join(dest, "config.md"))).toBe(true);
    expect(await exists(join(dest, "config/"))).toBe(true);
    expect(await exists(join(dest, LOCK_FILENAME))).toBe(true);
  });

  it("skips items that no longer exist in destination", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();
    const { rm } = await import("node:fs/promises");
    await rm(join(dest, "config.md"));

    const result = await cleanWorktree(dest, { dryRun: false });

    expect(result.removed).toEqual(["config/"]);
    expect(result.notFound).toEqual(["config.md"]);
    expect(result.lockRemoved).toBe(true);
  });
});
