import { readlink } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { linkProviders } from "../../../src/core/linker.js";
import type { Provider } from "../../../src/providers/registry.js";
import { exists } from "../../../src/utils/fs.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("linker", () => {
  let src: string;
  let dest: string;

  const provider: Provider = {
    name: "test",
    label: "Test",
    paths: ["config/", "config.md"],
  };

  beforeEach(async () => {
    src = await createTempDir();
    dest = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(src);
    await removeTempDir(dest);
  });

  it("links a file from source to destination", async () => {
    await scaffold(src, { "config.md": "hello" });
    await linkProviders(src, dest, [provider], { force: false, dryRun: false });
    const linkTarget = await readlink(join(dest, "config.md"));
    expect(linkTarget).toBe(relative(dest, join(src, "config.md")));
  });

  it("links a directory from source to destination", async () => {
    await scaffold(src, { "config/a.txt": "aaa" });
    await linkProviders(src, dest, [provider], { force: false, dryRun: false });
    const linkTarget = await readlink(join(dest, "config"));
    expect(linkTarget).toBe(relative(dest, resolve(src, "config/")));
  });

  it("skips non-existent source paths", async () => {
    const result = await linkProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.linked).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips existing destination paths when force=false", async () => {
    await scaffold(src, { "config.md": "new" });
    await scaffold(dest, { "config.md": "old" });
    const result = await linkProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.skipped).toContain("config.md");
    expect(result.linked).toHaveLength(0);
  });

  it("removes and re-links when force=true", async () => {
    await scaffold(src, { "config.md": "new" });
    await scaffold(dest, { "config.md": "old" });
    const result = await linkProviders(src, dest, [provider], {
      force: true,
      dryRun: false,
    });
    expect(result.linked).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    const linkTarget = await readlink(join(dest, "config.md"));
    expect(linkTarget).toBe(relative(dest, join(src, "config.md")));
  });

  it("dry-run does not create symlinks", async () => {
    await scaffold(src, { "config.md": "content" });
    await linkProviders(src, dest, [provider], { force: false, dryRun: true });
    expect(await exists(join(dest, "config.md"))).toBe(false);
  });

  it("dry-run still returns target in linked array", async () => {
    await scaffold(src, { "config.md": "content" });
    const result = await linkProviders(src, dest, [provider], {
      force: false,
      dryRun: true,
    });
    expect(result.linked).toHaveLength(1);
    expect(result.linked[0].target).toBe(
      relative(dest, join(src, "config.md")),
    );
  });

  it("returns correct LinkItem metadata", async () => {
    await scaffold(src, { "config.md": "hello", "config/a.txt": "aaa" });
    const result = await linkProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.linked).toHaveLength(2);

    const dir = result.linked.find((l) => l.path === "config/");
    const file = result.linked.find((l) => l.path === "config.md");
    expect(dir).toMatchObject({ type: "directory", provider: "test" });
    expect(file).toMatchObject({ type: "file", provider: "test" });
  });

  it("target is a relative path", async () => {
    await scaffold(src, { "config.md": "hello" });
    const result = await linkProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.linked[0].target).toMatch(/^\.\.\//);
  });

  it("handles multiple providers", async () => {
    const p2: Provider = { name: "other", label: "Other", paths: ["other.md"] };
    await scaffold(src, { "config.md": "a", "other.md": "b" });
    const result = await linkProviders(src, dest, [provider, p2], {
      force: false,
      dryRun: false,
    });
    expect(result.linked).toHaveLength(2);
    expect(result.linked.map((l) => l.provider)).toContain("test");
    expect(result.linked.map((l) => l.provider)).toContain("other");
  });
});
