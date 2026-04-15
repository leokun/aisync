import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyProviders } from "../../../src/core/copier.js";
import type { Provider } from "../../../src/providers/registry.js";
import { exists } from "../../../src/utils/fs.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("copier", () => {
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

  it("copies a file from source to destination", async () => {
    await scaffold(src, { "config.md": "hello" });
    await copyProviders(src, dest, [provider], { force: false, dryRun: false });
    const content = await readFile(join(dest, "config.md"), "utf-8");
    expect(content).toBe("hello");
  });

  it("copies a directory from source to destination", async () => {
    await scaffold(src, { "config/a.txt": "aaa" });
    await copyProviders(src, dest, [provider], { force: false, dryRun: false });
    const content = await readFile(join(dest, "config/a.txt"), "utf-8");
    expect(content).toBe("aaa");
  });

  it("skips non-existent source paths", async () => {
    // Neither config/ nor config.md exist in source
    const result = await copyProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.copied).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips existing destination paths when force=false", async () => {
    await scaffold(src, { "config.md": "new" });
    await scaffold(dest, { "config.md": "old" });
    const result = await copyProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.skipped).toContain("config.md");
    expect(result.copied).toHaveLength(0);
    // Original content preserved
    expect(await readFile(join(dest, "config.md"), "utf-8")).toBe("old");
  });

  it("overwrites existing destination when force=true", async () => {
    await scaffold(src, { "config.md": "new" });
    await scaffold(dest, { "config.md": "old" });
    const result = await copyProviders(src, dest, [provider], {
      force: true,
      dryRun: false,
    });
    expect(result.copied).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(await readFile(join(dest, "config.md"), "utf-8")).toBe("new");
  });

  it("dry-run does not create files", async () => {
    await scaffold(src, { "config.md": "content" });
    await copyProviders(src, dest, [provider], { force: false, dryRun: true });
    expect(await exists(join(dest, "config.md"))).toBe(false);
  });

  it("dry-run still returns hashes in copied array", async () => {
    await scaffold(src, { "config.md": "content" });
    const result = await copyProviders(src, dest, [provider], {
      force: false,
      dryRun: true,
    });
    expect(result.copied).toHaveLength(1);
    expect(result.copied[0].hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns correct CopyItem metadata", async () => {
    await scaffold(src, { "config.md": "hello", "config/a.txt": "aaa" });
    const result = await copyProviders(src, dest, [provider], {
      force: false,
      dryRun: false,
    });
    expect(result.copied).toHaveLength(2);

    const dir = result.copied.find((c) => c.path === "config/");
    const file = result.copied.find((c) => c.path === "config.md");
    expect(dir).toMatchObject({ type: "directory", provider: "test" });
    expect(file).toMatchObject({ type: "file", provider: "test" });
    expect(dir?.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(file?.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("handles multiple providers", async () => {
    const p2: Provider = { name: "other", label: "Other", paths: ["other.md"] };
    await scaffold(src, { "config.md": "a", "other.md": "b" });
    const result = await copyProviders(src, dest, [provider, p2], {
      force: false,
      dryRun: false,
    });
    expect(result.copied).toHaveLength(2);
    expect(result.copied.map((c) => c.provider)).toContain("test");
    expect(result.copied.map((c) => c.provider)).toContain("other");
  });
});
