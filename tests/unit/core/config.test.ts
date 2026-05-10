import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_FILE, readConfig } from "../../../src/core/config.js";
import { createTempDir, removeTempDir } from "../../helpers/fixtures.js";

describe("readConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it("returns null when no config file exists", async () => {
    const config = await readConfig(dir);
    expect(config).toBeNull();
  });

  it("reads source field", async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({ source: "../main" }),
    );
    const config = await readConfig(dir);
    expect(config?.source).toBe("../main");
  });

  it("reads only and exclude arrays", async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({ only: ["claude"], exclude: ["aider"] }),
    );
    const config = await readConfig(dir);
    expect(config?.only).toEqual(["claude"]);
    expect(config?.exclude).toEqual(["aider"]);
  });

  it("reads custom providers", async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({
        providers: [{ name: "my-tool", label: "My Tool", paths: [".mytool/"] }],
      }),
    );
    const config = await readConfig(dir);
    expect(config?.providers).toHaveLength(1);
    expect(config?.providers?.[0]).toEqual({
      name: "my-tool",
      label: "My Tool",
      paths: [".mytool/"],
    });
  });

  it("reads templates map", async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({
        templates: {
          claude: { "CLAUDE.md": "# Custom\n" },
        },
      }),
    );
    const config = await readConfig(dir);
    expect(config?.templates?.claude).toEqual({ "CLAUDE.md": "# Custom\n" });
  });

  it("returns empty config object when JSON is empty", async () => {
    await writeFile(join(dir, CONFIG_FILE), "{}");
    const config = await readConfig(dir);
    expect(config).toEqual({});
  });

  it("sets exitCode and returns null on invalid JSON", async () => {
    await writeFile(join(dir, CONFIG_FILE), "{not valid");
    const before = process.exitCode;
    const config = await readConfig(dir);
    expect(config).toBeNull();
    expect(process.exitCode).toBe(1);
    process.exitCode = before;
  });

  it("rejects non-object root", async () => {
    await writeFile(join(dir, CONFIG_FILE), "[]");
    const before = process.exitCode;
    const config = await readConfig(dir);
    expect(config).toBeNull();
    expect(process.exitCode).toBe(1);
    process.exitCode = before;
  });

  it("rejects providers with missing fields", async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({ providers: [{ name: "bad" }] }),
    );
    const before = process.exitCode;
    const config = await readConfig(dir);
    expect(config).toBeNull();
    expect(process.exitCode).toBe(1);
    process.exitCode = before;
  });

  it("rejects non-string source", async () => {
    await writeFile(join(dir, CONFIG_FILE), JSON.stringify({ source: 42 }));
    const before = process.exitCode;
    const config = await readConfig(dir);
    expect(config).toBeNull();
    expect(process.exitCode).toBe(1);
    process.exitCode = before;
  });
});
