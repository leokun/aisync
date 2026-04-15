import { describe, expect, it } from "vitest";
import { isWindows } from "../../../src/utils/platform.js";

describe("isWindows", () => {
  it("returns a boolean", () => {
    expect(typeof isWindows()).toBe("boolean");
  });

  it("returns false on non-Windows platform", () => {
    expect(isWindows()).toBe(false);
  });
});
