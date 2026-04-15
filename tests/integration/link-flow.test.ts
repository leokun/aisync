import { readFile, readlink } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { linkProviders } from "../../src/core/linker.js";
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

describe("link flow (integration)", () => {
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

  it("links files and creates lock", async () => {
    await scaffold(src, {
      ".claude/settings.json": '{"key": "value"}',
      "CLAUDE.md": "# Claude",
      ".cursorrules": "rule1",
    });

    const result = await linkProviders(src, dest, [claude, cursor], {
      force: false,
      dryRun: false,
    });

    // Symlinks created and resolve to source content
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe("# Claude");
    expect(await readFile(join(dest, ".cursorrules"), "utf-8")).toBe("rule1");

    // Verify they are symlinks
    const claudeTarget = await readlink(join(dest, "CLAUDE.md"));
    expect(claudeTarget).toBe(relative(dest, join(src, "CLAUDE.md")));

    // Result metadata
    expect(result.linked).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);

    // Write and verify lock
    await writeLock(dest, src, result.linked, "link");
    const lock = await readLock(dest);
    expect(lock).not.toBeNull();
    expect(lock?.source).toBe(src);
    expect(lock?.mode).toBe("link");
    expect(lock?.items).toHaveLength(3);
    expect(lock?.items[0].target).toBeDefined();
    expect(lock?.items[0].hash).toBeUndefined();
  });

  it("skips existing files without force", async () => {
    await scaffold(src, { "CLAUDE.md": "new content" });
    await scaffold(dest, { "CLAUDE.md": "old content" });

    const result = await linkProviders(src, dest, [claude], {
      force: false,
      dryRun: false,
    });

    expect(result.skipped).toContain("CLAUDE.md");
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe(
      "old content",
    );
  });

  it("removes and re-links with force", async () => {
    await scaffold(src, { "CLAUDE.md": "new content" });
    await scaffold(dest, { "CLAUDE.md": "old content" });

    const result = await linkProviders(src, dest, [claude], {
      force: true,
      dryRun: false,
    });

    expect(result.linked).toHaveLength(1);
    // Now it is a symlink pointing to source
    const target = await readlink(join(dest, "CLAUDE.md"));
    expect(target).toBe(relative(dest, join(src, "CLAUDE.md")));
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe(
      "new content",
    );
  });

  it("lock file round-trips correctly with link mode", async () => {
    await scaffold(src, { "CLAUDE.md": "content" });

    const result = await linkProviders(src, dest, [claude], {
      force: false,
      dryRun: false,
    });

    await writeLock(dest, src, result.linked, "link");
    const lock = await readLock(dest);

    expect(lock?.version).toBe(1);
    expect(lock?.mode).toBe("link");
    expect(lock?.items[0].path).toBe("CLAUDE.md");
    expect(lock?.items[0].type).toBe("file");
    expect(lock?.items[0].provider).toBe("claude");
    expect(lock?.items[0].target).toBe(relative(dest, join(src, "CLAUDE.md")));
    expect(lock?.items[0].hash).toBeUndefined();
  });

  it("dry run creates no symlinks and no lock", async () => {
    await scaffold(src, { "CLAUDE.md": "content", ".cursorrules": "rule" });

    const result = await linkProviders(src, dest, [claude, cursor], {
      force: false,
      dryRun: true,
    });

    // No symlinks created
    expect(await exists(join(dest, "CLAUDE.md"))).toBe(false);
    expect(await exists(join(dest, ".cursorrules"))).toBe(false);

    // But result still has items with targets
    expect(result.linked).toHaveLength(2);
    expect(result.linked[0].target).toMatch(/^\.\.\//);

    // No lock file
    expect(await readLock(dest)).toBeNull();
  });

  it("symlinks resolve to source content and reflect changes", async () => {
    await scaffold(src, { "CLAUDE.md": "original" });

    await linkProviders(src, dest, [claude], {
      force: false,
      dryRun: false,
    });

    // Read through symlink
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe("original");

    // Modify source, read through symlink again
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(src, "CLAUDE.md"), "modified", "utf-8");
    expect(await readFile(join(dest, "CLAUDE.md"), "utf-8")).toBe("modified");
  });
});
