import type { Provider } from "./registry.js";

export const claude: Provider = {
  name: "claude",
  label: "Claude Code",
  paths: [".claude/", "CLAUDE.md"],
};
