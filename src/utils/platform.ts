import { platform } from "node:os";

export function isWindows(): boolean {
  return platform() === "win32";
}

export function isTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
