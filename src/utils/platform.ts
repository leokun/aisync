import { platform } from "node:os";

export function isWindows(): boolean {
  return platform() === "win32";
}
