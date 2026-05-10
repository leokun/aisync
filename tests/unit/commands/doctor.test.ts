import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/doctor.js", () => ({
  diagnose: vi.fn(),
  DoctorError: class DoctorError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DoctorError";
    }
  },
}));

vi.mock("../../../src/utils/logger.js", () => ({
  setVerbose: vi.fn(),
  header: vi.fn(),
  item: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
}));

import { doctor } from "../../../src/commands/doctor.js";
import { DoctorError, diagnose } from "../../../src/core/doctor.js";
import * as log from "../../../src/utils/logger.js";

const mockDiagnose = vi.mocked(diagnose);

describe("doctor command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("logs an error and sets exit code when no lock", async () => {
    mockDiagnose.mockRejectedValue(new DoctorError("no lock"));
    await doctor({});
    expect(log.error).toHaveBeenCalledWith("no lock");
    expect(process.exitCode).toBe(1);
  });

  it("prints the report and stays exitCode 0 with synced items", async () => {
    mockDiagnose.mockResolvedValue({
      destination: "/dest",
      source: "/src",
      lastSync: "2026-05-10T17:00:00.000Z",
      mode: "copy",
      items: [
        {
          path: "config.md",
          provider: "test",
          type: "file",
          status: "synced",
        },
      ],
      counts: {
        synced: 1,
        stale: 0,
        drift: 0,
        conflict: 0,
        "missing-source": 0,
        "missing-dest": 0,
      },
    });
    await doctor({});
    expect(log.header).toHaveBeenCalledWith("doctor");
    expect(process.exitCode).toBeUndefined();
  });

  it("sets exit code 1 when conflict count > 0", async () => {
    mockDiagnose.mockResolvedValue({
      destination: "/dest",
      source: "/src",
      lastSync: "2026-05-10T17:00:00.000Z",
      mode: "copy",
      items: [
        {
          path: "config.md",
          provider: "test",
          type: "file",
          status: "conflict",
        },
      ],
      counts: {
        synced: 0,
        stale: 0,
        drift: 0,
        conflict: 1,
        "missing-source": 0,
        "missing-dest": 0,
      },
    });
    await doctor({});
    expect(process.exitCode).toBe(1);
  });

  it("emits JSON when --json is set", async () => {
    const report = {
      destination: "/dest",
      source: "/src",
      lastSync: "2026-05-10T17:00:00.000Z",
      mode: "copy" as const,
      items: [],
      counts: {
        synced: 0,
        stale: 0,
        drift: 0,
        conflict: 0,
        "missing-source": 0,
        "missing-dest": 0,
      },
    };
    mockDiagnose.mockResolvedValue(report);
    const consoleLog = vi.spyOn(console, "log");
    await doctor({ json: true });
    expect(consoleLog).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
    expect(log.header).not.toHaveBeenCalled();
  });
});
