import { homedir, platform } from "node:os";
import { join } from "node:path";

export function globalConfigPath(): string {
  if (platform() === "win32") {
    const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(base, "aisync", "config.json");
  }
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "aisync", "config.json");
}
