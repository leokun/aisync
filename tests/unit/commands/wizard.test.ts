import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockMultiselect = vi.fn();
const mockText = vi.fn();
const mockCancel = vi.fn();
const mockIsCancel = vi.fn();

vi.mock("@clack/prompts", () => ({
  select: (opts: unknown) => mockSelect(opts),
  multiselect: (opts: unknown) => mockMultiselect(opts),
  text: (opts: unknown) => mockText(opts),
  cancel: (msg: unknown) => mockCancel(msg),
  isCancel: (val: unknown) => mockIsCancel(val),
}));

const mockCopy = vi.fn();
const mockLink = vi.fn();
const mockPull = vi.fn();
const mockInit = vi.fn();
const mockStatus = vi.fn();
const mockListProviders = vi.fn();
const mockListWorktrees = vi.fn();

vi.mock("../../../src/commands/copy.js", () => ({
  copy: (...args: unknown[]) => mockCopy(...args),
}));
vi.mock("../../../src/commands/link.js", () => ({
  link: (...args: unknown[]) => mockLink(...args),
}));
vi.mock("../../../src/commands/pull.js", () => ({
  pull: (...args: unknown[]) => mockPull(...args),
}));
vi.mock("../../../src/commands/init.js", () => ({
  init: (...args: unknown[]) => mockInit(...args),
}));
vi.mock("../../../src/commands/status.js", () => ({
  status: (...args: unknown[]) => mockStatus(...args),
}));
vi.mock("../../../src/commands/list.js", () => ({
  listProviders: (...args: unknown[]) => mockListProviders(...args),
  listWorktrees: (...args: unknown[]) => mockListWorktrees(...args),
}));

const mockIsGitRepo = vi.fn();
const mockGetWorktrees = vi.fn();
const mockFindCandidateSources = vi.fn();
vi.mock("../../../src/core/git.js", () => ({
  isGitRepo: (...args: unknown[]) => mockIsGitRepo(...args),
  getWorktrees: (...args: unknown[]) => mockGetWorktrees(...args),
  findCandidateSources: (...args: unknown[]) =>
    mockFindCandidateSources(...args),
}));

describe("runWizard", () => {
  let originalStdinTTY: boolean | undefined;
  let originalStdoutTTY: boolean | undefined;

  beforeEach(() => {
    originalStdinTTY = process.stdin.isTTY;
    originalStdoutTTY = process.stdout.isTTY;
    mockSelect.mockReset();
    mockMultiselect.mockReset();
    mockText.mockReset();
    mockCancel.mockReset();
    mockIsCancel.mockReset();
    mockIsCancel.mockReturnValue(false);
    mockCopy.mockReset();
    mockLink.mockReset();
    mockPull.mockReset();
    mockInit.mockReset();
    mockStatus.mockReset();
    mockListProviders.mockReset();
    mockListWorktrees.mockReset();
    mockIsGitRepo.mockReset();
    mockGetWorktrees.mockReset();
    mockFindCandidateSources.mockReset();
    process.exitCode = 0;
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
    process.exitCode = 0;
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

  it("errors out when not in TTY", async () => {
    setTTY(false);
    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();
    expect(process.exitCode).toBe(1);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("dispatches to status when 'status' selected", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("status");
    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();
    expect(mockStatus).toHaveBeenCalledOnce();
  });

  it("dispatches to init with interactive flag when 'init' selected", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("init");
    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();
    expect(mockInit).toHaveBeenCalledWith({ interactive: true });
  });

  it("dispatches to listProviders when 'list' -> 'providers'", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("list").mockResolvedValueOnce("providers");
    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();
    expect(mockListProviders).toHaveBeenCalledOnce();
    expect(mockListWorktrees).not.toHaveBeenCalled();
  });

  it("dispatches to listWorktrees when 'list' -> 'worktrees'", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("list").mockResolvedValueOnce("worktrees");
    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();
    expect(mockListWorktrees).toHaveBeenCalledOnce();
    expect(mockListProviders).not.toHaveBeenCalled();
  });

  it("runs copy across multiple destinations from worktree picker", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("copy");
    mockText.mockResolvedValueOnce(".");
    mockIsGitRepo.mockResolvedValueOnce(true);
    mockGetWorktrees.mockResolvedValueOnce([
      { path: "/repo/main", branch: "main", bare: false },
      { path: "/repo/feature-a", branch: "feature-a", bare: false },
      { path: "/repo/feature-b", branch: "feature-b", bare: false },
    ]);
    mockMultiselect.mockResolvedValueOnce([
      "/repo/feature-a",
      "/repo/feature-b",
    ]);

    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();

    expect(mockCopy).toHaveBeenCalledTimes(2);
    expect(mockCopy.mock.calls[0][1]).toBe("/repo/feature-a");
    expect(mockCopy.mock.calls[1][1]).toBe("/repo/feature-b");
    const opts = mockCopy.mock.calls[0][2];
    expect(opts).toMatchObject({
      dryRun: false,
      force: false,
      verbose: false,
      interactive: true,
    });
    expect(mockLink).not.toHaveBeenCalled();
  });

  it("runs link with manual destinations when not in a git repo", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("link");
    mockText
      .mockResolvedValueOnce(".")
      .mockResolvedValueOnce("../wt-a, ../wt-b");
    mockIsGitRepo.mockResolvedValueOnce(false);

    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();

    expect(mockLink).toHaveBeenCalledTimes(2);
    expect(mockLink.mock.calls[0][1]).toBe("../wt-a");
    expect(mockLink.mock.calls[1][1]).toBe("../wt-b");
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("merges manual entry with worktree picks", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("copy");
    mockText.mockResolvedValueOnce(".").mockResolvedValueOnce("../extra");
    mockIsGitRepo.mockResolvedValueOnce(true);
    mockGetWorktrees.mockResolvedValueOnce([
      { path: "/repo/feature-a", branch: "feature-a", bare: false },
    ]);
    mockMultiselect.mockResolvedValueOnce(["/repo/feature-a", "__manual__"]);

    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();

    expect(mockCopy).toHaveBeenCalledTimes(2);
    expect(mockCopy.mock.calls[0][1]).toBe("/repo/feature-a");
    expect(mockCopy.mock.calls[1][1]).toBe("../extra");
  });

  it("dispatches to pull with chosen source from candidate list", async () => {
    setTTY(true);
    mockSelect
      .mockResolvedValueOnce("pull")
      .mockResolvedValueOnce("/repo/main");
    mockIsGitRepo.mockResolvedValueOnce(true);
    mockFindCandidateSources.mockResolvedValueOnce([
      { path: "/repo/main", branch: "main", bare: false },
      { path: "/repo/feature-a", branch: "feature-a", bare: false },
    ]);

    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();

    expect(mockPull).toHaveBeenCalledOnce();
    expect(mockPull.mock.calls[0][0]).toBe("/repo/main");
    expect(mockPull.mock.calls[0][1]).toMatchObject({
      dryRun: false,
      force: false,
      verbose: false,
      interactive: true,
    });
  });

  it("excludes the source worktree from destination choices", async () => {
    setTTY(true);
    mockSelect.mockResolvedValueOnce("copy");
    mockText.mockResolvedValueOnce("/repo/main");
    mockIsGitRepo.mockResolvedValueOnce(true);
    mockGetWorktrees.mockResolvedValueOnce([
      { path: "/repo/main", branch: "main", bare: false },
      { path: "/repo/feature-a", branch: "feature-a", bare: false },
    ]);
    mockMultiselect.mockResolvedValueOnce(["/repo/feature-a"]);

    const { runWizard } = await import("../../../src/commands/wizard.js");
    await runWizard();

    const opts = mockMultiselect.mock.calls[0][0];
    const labels = opts.options.map(
      (o: { label: string; value: string }) => o.value,
    );
    expect(labels).toContain("/repo/feature-a");
    expect(labels).not.toContain("/repo/main");
  });
});
