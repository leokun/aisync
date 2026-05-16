import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONFIG_FILE,
  readConfig,
  readGlobalConfig,
  readProjectConfig,
} from "../../../src/core/config.js";
import { createTempDir, removeTempDir } from "../../helpers/fixtures.js";

describe("readConfig", () => {
  let dir: string;
  let xdgDir: string;
  let originalXdg: string | undefined;

  beforeEach(async () => {
    dir = await createTempDir();
    xdgDir = await createTempDir();
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = xdgDir;
  });

  afterEach(async () => {
    await removeTempDir(dir);
    await removeTempDir(xdgDir);
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
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

describe("global + project config merging", () => {
  let projectDir: string;
  let xdgDir: string;
  let originalXdg: string | undefined;

  async function writeGlobal(content: object): Promise<void> {
    const dir = join(xdgDir, "aisync");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "config.json"), JSON.stringify(content));
  }

  async function writeProject(content: object): Promise<void> {
    await writeFile(join(projectDir, CONFIG_FILE), JSON.stringify(content));
  }

  beforeEach(async () => {
    projectDir = await createTempDir();
    xdgDir = await createTempDir();
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = xdgDir;
  });

  afterEach(async () => {
    await removeTempDir(projectDir);
    await removeTempDir(xdgDir);
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
  });

  it("readGlobalConfig returns null when no file present", async () => {
    const config = await readGlobalConfig();
    expect(config).toBeNull();
  });

  it("readProjectConfig returns null when no file present", async () => {
    const config = await readProjectConfig(projectDir);
    expect(config).toBeNull();
  });

  it("returns project config alone when no global", async () => {
    await writeProject({ only: ["claude"] });
    const config = await readConfig(projectDir);
    expect(config).toEqual({ only: ["claude"] });
  });

  it("returns global config alone when no project", async () => {
    await writeGlobal({ only: ["claude"] });
    const config = await readConfig(projectDir);
    expect(config).toEqual({ only: ["claude"] });
  });

  it("merges global and project keys when both present", async () => {
    await writeGlobal({ only: ["claude"] });
    await writeProject({ exclude: ["cursor"] });
    const config = await readConfig(projectDir);
    expect(config).toEqual({ only: ["claude"], exclude: ["cursor"] });
  });

  it("project overrides global on overlapping keys", async () => {
    await writeGlobal({ only: ["a"], exclude: ["z"] });
    await writeProject({ only: ["b"] });
    const config = await readConfig(projectDir);
    expect(config?.only).toEqual(["b"]);
    expect(config?.exclude).toEqual(["z"]);
  });
});
