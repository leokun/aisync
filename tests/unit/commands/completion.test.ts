import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completion } from "../../../src/commands/completion.js";
import { getProviderNames } from "../../../src/providers/registry.js";

describe("completion command", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(
        ((_code?: number) => undefined as never) as typeof process.exit,
      );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const commandNames = [
    "copy",
    "pull",
    "link",
    "init",
    "status",
    "list",
    "watch",
    "hook",
    "doctor",
    "clean",
    "completion",
  ];

  describe.each(["bash", "zsh", "fish"] as const)("%s script", (shell) => {
    it("includes every top-level command name", () => {
      completion(shell);

      const output = (stdoutSpy.mock.calls[0]?.[0] ?? "") as string;
      for (const name of commandNames) {
        expect(output).toContain(name);
      }
    });

    it("includes every provider name from the registry", () => {
      completion(shell);

      const output = (stdoutSpy.mock.calls[0]?.[0] ?? "") as string;
      for (const provider of getProviderNames()) {
        expect(output).toContain(provider);
      }
    });
  });

  it("bash script contains the complete -F anchor", () => {
    completion("bash");
    const output = (stdoutSpy.mock.calls[0]?.[0] ?? "") as string;
    expect(output).toContain("complete -F _aisync aisync");
  });

  it("zsh script contains the #compdef header", () => {
    completion("zsh");
    const output = (stdoutSpy.mock.calls[0]?.[0] ?? "") as string;
    expect(output).toContain("#compdef aisync");
  });

  it("fish script contains complete -c aisync directives", () => {
    completion("fish");
    const output = (stdoutSpy.mock.calls[0]?.[0] ?? "") as string;
    expect(output).toContain("complete -c aisync");
  });

  it("rejects an unsupported shell with a stderr message and exit 1", () => {
    completion("powershell");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("unsupported shell"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
