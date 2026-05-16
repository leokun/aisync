import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  error,
  header,
  item,
  log,
  setQuiet,
  setVerbose,
  success,
  verbose,
  warn,
} from "../../../src/utils/logger.js";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setVerbose(false);
    setQuiet(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("log", () => {
    it("calls console.log with the message", () => {
      log("hello");
      expect(logSpy).toHaveBeenCalledWith("hello");
    });
  });

  describe("verbose", () => {
    it("does nothing when verbose mode is off", () => {
      verbose("hidden");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("outputs when verbose mode is on", () => {
      setVerbose(true);
      verbose("visible");
      expect(logSpy).toHaveBeenCalledOnce();
      expect(logSpy.mock.calls[0][0]).toContain("visible");
    });

    it("stops outputting after setVerbose(false)", () => {
      setVerbose(true);
      setVerbose(false);
      verbose("hidden again");
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("success", () => {
    it("writes to console.log with checkmark", () => {
      success("done");
      expect(logSpy).toHaveBeenCalledOnce();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("done");
    });
  });

  describe("warn", () => {
    it("writes to console.log with exclamation", () => {
      warn("careful");
      expect(logSpy).toHaveBeenCalledOnce();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("careful");
    });
  });

  describe("error", () => {
    it("writes to console.error", () => {
      error("oops");
      expect(errorSpy).toHaveBeenCalledOnce();
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain("oops");
    });
  });

  describe("item", () => {
    it("pads name to 20 chars and appends status", () => {
      item("file.md", "ok");
      expect(logSpy).toHaveBeenCalledOnce();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("file.md");
      expect(output).toContain("ok");
      // Name should be padded to at least 20 chars
      expect(output).toMatch(/file\.md\s+ok/);
    });
  });

  describe("header", () => {
    it("outputs title with aisync prefix", () => {
      header("copy");
      // header outputs 3 lines: empty, title, empty
      expect(logSpy).toHaveBeenCalledTimes(3);
      const titleLine = logSpy.mock.calls[1][0] as string;
      expect(titleLine).toContain("aisync");
      expect(titleLine).toContain("copy");
    });
  });

  describe("setQuiet", () => {
    it("suppresses log when enabled", () => {
      setQuiet(true);
      log("hidden");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses success, item, and header when enabled", () => {
      setQuiet(true);
      success("done");
      item("file.md", "ok");
      header("copy");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses verbose even when verbose mode is on", () => {
      setVerbose(true);
      setQuiet(true);
      verbose("debug");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("does NOT suppress warn", () => {
      setQuiet(true);
      warn("careful");
      expect(logSpy).toHaveBeenCalledOnce();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("careful");
    });

    it("does NOT suppress error", () => {
      setQuiet(true);
      error("boom");
      expect(errorSpy).toHaveBeenCalledOnce();
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain("boom");
    });

    it("restores output when disabled", () => {
      setQuiet(true);
      log("hidden");
      setQuiet(false);
      log("visible");
      expect(logSpy).toHaveBeenCalledOnce();
      expect(logSpy.mock.calls[0][0]).toBe("visible");
    });
  });
});
