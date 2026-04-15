import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copyItem,
  exists,
  isDirectory,
  readJson,
  writeJson,
} from "../../../src/utils/fs.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("fs utils", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

  describe("exists", () => {
    it("returns true for an existing file", async () => {
      await scaffold(tmp, { "file.txt": "hello" });
      expect(await exists(join(tmp, "file.txt"))).toBe(true);
    });

    it("returns true for an existing directory", async () => {
      await mkdir(join(tmp, "dir"), { recursive: true });
      expect(await exists(join(tmp, "dir"))).toBe(true);
    });

    it("returns false for a non-existent path", async () => {
      expect(await exists(join(tmp, "nope"))).toBe(false);
    });
  });

  describe("isDirectory", () => {
    it("returns true for a directory", async () => {
      await mkdir(join(tmp, "dir"), { recursive: true });
      expect(await isDirectory(join(tmp, "dir"))).toBe(true);
    });

    it("returns false for a file", async () => {
      await scaffold(tmp, { "file.txt": "hello" });
      expect(await isDirectory(join(tmp, "file.txt"))).toBe(false);
    });

    it("returns false for a non-existent path", async () => {
      expect(await isDirectory(join(tmp, "nope"))).toBe(false);
    });
  });

  describe("copyItem", () => {
    it("copies a file to destination", async () => {
      await scaffold(tmp, { "src/file.txt": "content" });
      await copyItem(join(tmp, "src/file.txt"), join(tmp, "dest/file.txt"));
      const content = await readFile(join(tmp, "dest/file.txt"), "utf-8");
      expect(content).toBe("content");
    });

    it("creates parent directories for destination", async () => {
      await scaffold(tmp, { "src/file.txt": "data" });
      await copyItem(join(tmp, "src/file.txt"), join(tmp, "a/b/c/file.txt"));
      expect(await exists(join(tmp, "a/b/c/file.txt"))).toBe(true);
    });

    it("copies a directory recursively", async () => {
      await scaffold(tmp, {
        "src/dir/a.txt": "aaa",
        "src/dir/sub/b.txt": "bbb",
      });
      await copyItem(join(tmp, "src/dir"), join(tmp, "dest/dir"));
      expect(await readFile(join(tmp, "dest/dir/a.txt"), "utf-8")).toBe("aaa");
      expect(await readFile(join(tmp, "dest/dir/sub/b.txt"), "utf-8")).toBe(
        "bbb",
      );
    });

    it("preserves file content", async () => {
      const content = "line1\nline2\nspecial chars: éàü 🎉";
      await scaffold(tmp, { "src/file.txt": content });
      await copyItem(join(tmp, "src/file.txt"), join(tmp, "dest/file.txt"));
      expect(await readFile(join(tmp, "dest/file.txt"), "utf-8")).toBe(content);
    });
  });

  describe("writeJson / readJson", () => {
    it("round-trips JSON data", async () => {
      const data = { key: "value", nested: { n: 42 } };
      const path = join(tmp, "data.json");
      await writeJson(path, data);
      const result = await readJson(path);
      expect(result).toEqual(data);
    });

    it("writes formatted JSON with trailing newline", async () => {
      const path = join(tmp, "out.json");
      await writeJson(path, { a: 1 });
      const raw = await readFile(path, "utf-8");
      expect(raw).toBe('{\n  "a": 1\n}\n');
    });
  });
});
