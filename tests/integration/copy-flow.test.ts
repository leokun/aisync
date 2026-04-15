import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyProviders } from "../../src/core/copier.js";
import { readLock, writeLock } from "../../src/core/lock.js";
import type { Provider } from "../../src/providers/registry.js";
import { exists } from "../../src/utils/fs.js";
import { createTempDir, removeTempDir, scaffold } from "../helpers/fixtures.js";

const claude: Provider = {
  name: "claude",
  label: "Claude Code",
  paths: [".claude/", "CLAUDE.md"],
};

const cursor: Provider = {
  name: "cursor",
  label: "Cursor",
  paths: [".cursor/", ".cursorrules"],
};

describe("copy flow (integration)", () => {
  let src: string;
  let dest: string;

  beforeEach(async () => {
    src = await createTempDir();
    dest = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(src);
    await removeTempDir(dest);
  });

  it("copies files and creates lock", async () => {
    await scaffold(src, {
      ".claude/settings.json": '{"key": "value"}',
      "CLAUDE.md": "# Claude",
      ".cursorrules": "rule1",
    });

    const result = await copyProviders(src, dest, [claude, cursor], {
      force: false,
      dryRun: false,
    });

    // Files copied
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe("# Claude");
    expect(await readFile(join(dest, ".claude/settings.json"), "utf-8")).toBe(
      '{"key": "value"}',
    );
    expect(await readFile(join(dest, ".cursorrules"), "utf-8")).toBe("rule1");

    // Result metadata
    expect(result.copied).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);

    // Write and verify lock
    await writeLock(dest, src, result.copied);
    const lock = await readLock(dest);
    expect(lock).not.toBeNull();
    expect(lock?.source).toBe(src);
    expect(lock?.items).toHaveLength(3);
  });

  it("skips existing files without force", async () => {
    await scaffold(src, { "CLAUDE.md": "new content" });
    await scaffold(dest, { "CLAUDE.md": "old content" });

    const result = await copyProviders(src, dest, [claude], {
      force: false,
      dryRun: false,
    });

    expect(result.skipped).toContain("CLAUDE.md");
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe(
      "old content",
    );
  });

  it("overwrites existing files with force", async () => {
    await scaffold(src, { "CLAUDE.md": "new content" });
    await scaffold(dest, { "CLAUDE.md": "old content" });

    const result = await copyProviders(src, dest, [claude], {
      force: true,
      dryRun: false,
    });

    expect(result.copied).toHaveLength(1);
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe(
      "new content",
    );
  });

  it("lock file round-trips correctly", async () => {
    await scaffold(src, { "CLAUDE.md": "content" });

    const result = await copyProviders(src, dest, [claude], {
      force: false,
      dryRun: false,
    });

    await writeLock(dest, src, result.copied);
    const lock = await readLock(dest);

    expect(lock?.version).toBe(1);
    expect(lock?.mode).toBe("copy");
    expect(lock?.items[0].path).toBe("CLAUDE.md");
    expect(lock?.items[0].type).toBe("file");
    expect(lock?.items[0].provider).toBe("claude");
    expect(lock?.items[0].hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("dry run creates no files and no lock", async () => {
    await scaffold(src, { "CLAUDE.md": "content", ".cursorrules": "rule" });

    const result = await copyProviders(src, dest, [claude, cursor], {
      force: false,
      dryRun: true,
    });

    // No files created
    expect(await exists(join(dest, "CLAUDE.md"))).toBe(false);
    expect(await exists(join(dest, ".cursorrules"))).toBe(false);

    // But result still has items with hashes
    expect(result.copied).toHaveLength(2);
    expect(result.copied[0].hash).toMatch(/^[0-9a-f]{8}$/);

    // No lock file
    expect(await readLock(dest)).toBeNull();
  });
});
