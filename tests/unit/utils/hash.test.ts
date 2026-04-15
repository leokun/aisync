import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashDirectory, hashFile, hashItem } from "../../../src/utils/hash.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("hash utils", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(tmp);
  });

  describe("hashFile", () => {
    it("returns an 8-char hex string", async () => {
      await scaffold(tmp, { "file.txt": "hello" });
      const hash = await hashFile(join(tmp, "file.txt"));
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it("is deterministic for the same content", async () => {
      await scaffold(tmp, { "a.txt": "same", "b.txt": "same" });
      const h1 = await hashFile(join(tmp, "a.txt"));
      const h2 = await hashFile(join(tmp, "b.txt"));
      expect(h1).toBe(h2);
    });

    it("returns different hash for different content", async () => {
      await scaffold(tmp, { "a.txt": "aaa", "b.txt": "bbb" });
      const h1 = await hashFile(join(tmp, "a.txt"));
      const h2 = await hashFile(join(tmp, "b.txt"));
      expect(h1).not.toBe(h2);
    });
  });

  describe("hashDirectory", () => {
    it("returns an 8-char hex string", async () => {
      await scaffold(tmp, { "dir/file.txt": "content" });
      const hash = await hashDirectory(join(tmp, "dir"));
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it("is deterministic across calls", async () => {
      await scaffold(tmp, { "dir/a.txt": "aaa", "dir/b.txt": "bbb" });
      const h1 = await hashDirectory(join(tmp, "dir"));
      const h2 = await hashDirectory(join(tmp, "dir"));
      expect(h1).toBe(h2);
    });

    it("changes when a file changes", async () => {
      await scaffold(tmp, { "dir1/a.txt": "v1", "dir2/a.txt": "v2" });
      const h1 = await hashDirectory(join(tmp, "dir1"));
      const h2 = await hashDirectory(join(tmp, "dir2"));
      expect(h1).not.toBe(h2);
    });

    it("includes nested files", async () => {
      await scaffold(tmp, {
        "dir/a.txt": "aaa",
        "dir/sub/b.txt": "bbb",
      });
      const hash = await hashDirectory(join(tmp, "dir"));
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("hashItem", () => {
    it("hashes a file", async () => {
      await scaffold(tmp, { "file.txt": "hello" });
      const fromItem = await hashItem(join(tmp, "file.txt"));
      const fromFile = await hashFile(join(tmp, "file.txt"));
      expect(fromItem).toBe(fromFile);
    });

    it("hashes a directory", async () => {
      await scaffold(tmp, { "dir/a.txt": "aaa" });
      const fromItem = await hashItem(join(tmp, "dir"));
      const fromDir = await hashDirectory(join(tmp, "dir"));
      expect(fromItem).toBe(fromDir);
    });
  });
});
