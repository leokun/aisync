import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyProviders } from "../../../src/core/copier.js";
import { DoctorError, diagnose } from "../../../src/core/doctor.js";
import { linkProviders } from "../../../src/core/linker.js";
import { writeLock } from "../../../src/core/lock.js";
import type { Provider } from "../../../src/providers/registry.js";
import {
  createTempDir,
  removeTempDir,
  scaffold,
} from "../../helpers/fixtures.js";

describe("doctor", () => {
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

  it("throws DoctorError when no lock file exists", async () => {
    await expect(diagnose(dest)).rejects.toBeInstanceOf(DoctorError);
  });

  it("reports all items as synced after a fresh copy", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();

    const report = await diagnose(dest);
    expect(report.counts.synced).toBe(2);
    expect(report.counts.stale).toBe(0);
    expect(report.counts.drift).toBe(0);
    expect(report.counts.conflict).toBe(0);
  });

  it("detects stale items when source changed", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();
    await writeFile(join(src, "config.md"), "changed", "utf-8");

    const report = await diagnose(dest);
    const item = report.items.find((i) => i.path === "config.md");
    expect(item?.status).toBe("stale");
    expect(report.counts.stale).toBe(1);
  });

  it("detects drift items when destination changed", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();
    await writeFile(join(dest, "config.md"), "local edit", "utf-8");

    const report = await diagnose(dest);
    const item = report.items.find((i) => i.path === "config.md");
    expect(item?.status).toBe("drift");
    expect(report.counts.drift).toBe(1);
  });

  it("detects conflict when both source and dest changed", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();
    await writeFile(join(src, "config.md"), "src changed", "utf-8");
    await writeFile(join(dest, "config.md"), "dest changed", "utf-8");

    const report = await diagnose(dest);
    const item = report.items.find((i) => i.path === "config.md");
    expect(item?.status).toBe("conflict");
    expect(report.counts.conflict).toBe(1);
  });

  it("detects missing-source", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();
    const { rm } = await import("node:fs/promises");
    await rm(join(src, "config.md"));

    const report = await diagnose(dest);
    const item = report.items.find((i) => i.path === "config.md");
    expect(item?.status).toBe("missing-source");
  });

  it("detects missing-dest", async () => {
    await scaffold(src, { "config.md": "hi", "config/a.txt": "a" });
    await syncCopy();
    const { rm } = await import("node:fs/promises");
    await rm(join(dest, "config.md"));

    const report = await diagnose(dest);
    const item = report.items.find((i) => i.path === "config.md");
    expect(item?.status).toBe("missing-dest");
  });

  it("treats link mode as synced even if dest content differs from lock hash", async () => {
    await scaffold(src, { "config.md": "hi" });
    const linkResult = await linkProviders(
      src,
      dest,
      [{ name: "test", label: "Test", paths: ["config.md"] }],
      { force: false, dryRun: false },
    );
    await writeLock(dest, src, linkResult.linked, "link");

    const report = await diagnose(dest);
    expect(report.mode).toBe("link");
    expect(report.counts.synced).toBe(1);
  });

  it("populates source, destination, lastSync from lock", async () => {
    await scaffold(src, { "config.md": "hi" });
    await syncCopy();
    const report = await diagnose(dest);
    expect(report.source).toBe(src);
    expect(report.destination).toBe(dest);
    expect(report.lastSync).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
