import { readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exists, linkItem, removeItem } from "../../../src/utils/fs.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("linkItem", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

  it("creates a symlink to a file", async () => {
    await scaffold(tmp, { "src/file.txt": "hello" });
    const target = join(tmp, "src/file.txt");
    const dest = join(tmp, "dest/file.txt");

    await linkItem(target, dest);

    const linkTarget = await readlink(dest);
    expect(linkTarget).toBe(target);
    expect(await readFile(dest, "utf-8")).toBe("hello");
  });

  it("creates a symlink to a directory", async () => {
    await scaffold(tmp, { "src/dir/a.txt": "aaa" });
    const target = join(tmp, "src/dir");
    const dest = join(tmp, "dest/dir");

    await linkItem(target, dest);

    const linkTarget = await readlink(dest);
    expect(linkTarget).toBe(target);
    expect(await readFile(join(dest, "a.txt"), "utf-8")).toBe("aaa");
  });

  it("creates parent directories if they do not exist", async () => {
    await scaffold(tmp, { "src/file.txt": "data" });
    const target = join(tmp, "src/file.txt");
    const dest = join(tmp, "a/b/c/file.txt");

    await linkItem(target, dest);

    expect(await exists(dest)).toBe(true);
  });

  it("fails if destination already exists", async () => {
    await scaffold(tmp, { "src/file.txt": "hello", "dest/file.txt": "old" });
    const target = join(tmp, "src/file.txt");
    const dest = join(tmp, "dest/file.txt");

    await expect(linkItem(target, dest)).rejects.toThrow();
  });
});

describe("removeItem", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

  it("removes a file", async () => {
    await scaffold(tmp, { "file.txt": "hello" });
    await removeItem(join(tmp, "file.txt"));
    expect(await exists(join(tmp, "file.txt"))).toBe(false);
  });

  it("removes a directory recursively", async () => {
    await scaffold(tmp, { "dir/a.txt": "aaa", "dir/sub/b.txt": "bbb" });
    await removeItem(join(tmp, "dir"));
    expect(await exists(join(tmp, "dir"))).toBe(false);
  });

  it("removes a symlink", async () => {
    await scaffold(tmp, { "src/file.txt": "hello" });
    const target = join(tmp, "src/file.txt");
    const dest = join(tmp, "link.txt");
    await linkItem(target, dest);

    await removeItem(dest);
    expect(await exists(dest)).toBe(false);
    // Source still exists
    expect(await exists(target)).toBe(true);
  });

  it("does not throw on non-existent path", async () => {
    await expect(removeItem(join(tmp, "nope"))).resolves.toBeUndefined();
  });
});
