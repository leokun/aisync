import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "../../../src/providers/registry.js";

const mockMultiselect = vi.fn();
const mockCancel = vi.fn();
const mockIsCancel = vi.fn();

vi.mock("@clack/prompts", () => ({
  multiselect: (opts: unknown) => mockMultiselect(opts),
  cancel: (msg: unknown) => mockCancel(msg),
  isCancel: (val: unknown) => mockIsCancel(val),
}));

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
const codex: Provider = {
  name: "codex",
  label: "OpenAI Codex",
  paths: [".codex/"],
};

describe("selectProviders", () => {
  let originalStdinTTY: boolean | undefined;
  let originalStdoutTTY: boolean | undefined;

  beforeEach(() => {
    originalStdinTTY = process.stdin.isTTY;
    originalStdoutTTY = process.stdout.isTTY;
    mockMultiselect.mockReset();
    mockCancel.mockReset();
    mockIsCancel.mockReset();
    mockIsCancel.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalStdinTTY,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalStdoutTTY,
      configurable: true,
    });
  });

  function setTTY(enabled: boolean): void {
    Object.defineProperty(process.stdin, "isTTY", {
      value: enabled,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: enabled,
      configurable: true,
    });
  }

  it("returns providers as-is when not in TTY", async () => {
    setTTY(false);
    const { selectProviders } = await import("../../../src/utils/prompt.js");
    const result = await selectProviders([claude, cursor, codex]);
    expect(result).toEqual([claude, cursor, codex]);
    expect(mockMultiselect).not.toHaveBeenCalled();
  });

  it("returns empty array when no providers detected", async () => {
    setTTY(true);
    const { selectProviders } = await import("../../../src/utils/prompt.js");
    const result = await selectProviders([]);
    expect(result).toEqual([]);
    expect(mockMultiselect).not.toHaveBeenCalled();
  });

  it("returns single provider as-is without prompting", async () => {
    setTTY(true);
    const { selectProviders } = await import("../../../src/utils/prompt.js");
    const result = await selectProviders([claude]);
    expect(result).toEqual([claude]);
    expect(mockMultiselect).not.toHaveBeenCalled();
  });

  it("prompts via multiselect when TTY and multiple providers", async () => {
    setTTY(true);
    mockMultiselect.mockResolvedValue(["claude", "codex"]);
    const { selectProviders } = await import("../../../src/utils/prompt.js");
    const result = await selectProviders([claude, cursor, codex]);
    expect(mockMultiselect).toHaveBeenCalledOnce();
    const opts = mockMultiselect.mock.calls[0][0];
    expect(opts.options).toEqual([
      { label: "Claude Code", value: "claude" },
      { label: "Cursor", value: "cursor" },
      { label: "OpenAI Codex", value: "codex" },
    ]);
    expect(opts.initialValues).toEqual(["claude", "cursor", "codex"]);
    expect(opts.required).toBe(true);
    expect(result).toEqual([claude, codex]);
  });

  it("exits cleanly when user cancels", async () => {
    setTTY(true);
    const cancelSym = Symbol("cancel");
    mockMultiselect.mockResolvedValue(cancelSym);
    mockIsCancel.mockImplementation((v) => v === cancelSym);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`__exit_${code ?? 0}__`);
    }) as never);
    const { selectProviders } = await import("../../../src/utils/prompt.js");
    await expect(selectProviders([claude, cursor])).rejects.toThrow(
      "__exit_0__",
    );
    expect(mockCancel).toHaveBeenCalledWith("Cancelled");
    exitSpy.mockRestore();
  });
});
