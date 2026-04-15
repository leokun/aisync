import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/bootstrapper.js", () => ({
  bootstrap: vi.fn(),
}));

vi.mock("../../../src/core/scanner.js", () => ({
  scanProviders: vi.fn(),
}));

vi.mock("../../../src/providers/registry.js", () => ({
  filterProviders: vi.fn(),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  header: vi.fn(),
  item: vi.fn(),
  success: vi.fn(),
}));

import { init } from "../../../src/commands/init.js";
import { bootstrap } from "../../../src/core/bootstrapper.js";
import { scanProviders } from "../../../src/core/scanner.js";
import { filterProviders } from "../../../src/providers/registry.js";
import * as log from "../../../src/utils/logger.js";

const mockBootstrap = vi.mocked(bootstrap);
const mockScanProviders = vi.mocked(scanProviders);
const mockFilterProviders = vi.mocked(filterProviders);

const claude = {
  name: "claude",
  label: "Claude Code",
  paths: [".claude/", "CLAUDE.md"],
};
const crossTool = {
  name: "cross-tool",
  label: "Cross-tool",
  paths: ["AGENTS.md", ".agents/"],
};

describe("init command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockFilterProviders.mockReturnValue([crossTool, claude]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls scanProviders and bootstrap", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: crossTool,
        foundPaths: [],
        missingPaths: ["AGENTS.md", ".agents/"],
      },
      {
        provider: claude,
        foundPaths: [],
        missingPaths: [".claude/", "CLAUDE.md"],
      },
    ]);
    mockBootstrap.mockResolvedValue({ generated: [] });

    await init({});

    expect(mockScanProviders).toHaveBeenCalledOnce();
    expect(mockBootstrap).toHaveBeenCalledOnce();
  });

  it("displays cross-tool base when detected", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: crossTool,
        foundPaths: ["AGENTS.md"],
        missingPaths: [".agents/"],
      },
      {
        provider: claude,
        foundPaths: [],
        missingPaths: [".claude/", "CLAUDE.md"],
      },
    ]);
    mockBootstrap.mockResolvedValue({ generated: [] });

    await init({});

    expect(log.item).toHaveBeenCalledWith("AGENTS.md", "✓");
  });

  it("displays (none) when no cross-tool paths found", async () => {
    mockScanProviders.mockResolvedValue([
      {
        provider: crossTool,
        foundPaths: [],
        missingPaths: ["AGENTS.md", ".agents/"],
      },
      {
        provider: claude,
        foundPaths: [],
        missingPaths: [".claude/", "CLAUDE.md"],
      },
    ]);
    mockBootstrap.mockResolvedValue({ generated: [] });

    await init({});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("(none)"));
  });

  it("displays detected providers with exists", async () => {
    mockScanProviders.mockResolvedValue([
      { provider: crossTool, foundPaths: [], missingPaths: ["AGENTS.md"] },
      {
        provider: claude,
        foundPaths: ["CLAUDE.md"],
        missingPaths: [".claude/"],
      },
    ]);
    mockBootstrap.mockResolvedValue({ generated: [] });

    await init({});

    expect(log.item).toHaveBeenCalledWith("claude", "CLAUDE.md (exists)");
  });

  it("displays not found for missing providers", async () => {
    mockScanProviders.mockResolvedValue([
      { provider: crossTool, foundPaths: [], missingPaths: ["AGENTS.md"] },
      {
        provider: claude,
        foundPaths: [],
        missingPaths: [".claude/", "CLAUDE.md"],
      },
    ]);
    mockBootstrap.mockResolvedValue({ generated: [] });

    await init({});

    expect(log.item).toHaveBeenCalledWith("claude", "not found");
  });

  it("displays generated files", async () => {
    mockScanProviders.mockResolvedValue([
      { provider: crossTool, foundPaths: [], missingPaths: ["AGENTS.md"] },
      {
        provider: claude,
        foundPaths: [],
        missingPaths: [".claude/", "CLAUDE.md"],
      },
    ]);
    mockBootstrap.mockResolvedValue({
      generated: [{ provider: claude, paths: ["CLAUDE.md"] }],
    });

    await init({});

    expect(log.item).toHaveBeenCalledWith(
      "CLAUDE.md",
      "references base config",
    );
    expect(log.success).toHaveBeenCalledWith("1 provider config(s) generated.");
  });

  it("displays nothing to generate when all exist", async () => {
    mockScanProviders.mockResolvedValue([
      { provider: crossTool, foundPaths: ["AGENTS.md"], missingPaths: [] },
      {
        provider: claude,
        foundPaths: ["CLAUDE.md"],
        missingPaths: [".claude/"],
      },
    ]);
    mockBootstrap.mockResolvedValue({ generated: [] });

    await init({});

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Nothing to generate"),
    );
  });

  it("passes only option to filterProviders", async () => {
    mockScanProviders.mockResolvedValue([]);
    mockBootstrap.mockResolvedValue({ generated: [] });
    mockFilterProviders.mockReturnValue([]);

    await init({ only: ["claude"] });

    expect(mockFilterProviders).toHaveBeenCalledWith(["claude"]);
  });
});
