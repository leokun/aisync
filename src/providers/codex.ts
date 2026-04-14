import type { Provider } from "./registry.js";

export const codex: Provider = {
  name: "codex",
  label: "OpenAI Codex",
  paths: [".codex/"],
};
