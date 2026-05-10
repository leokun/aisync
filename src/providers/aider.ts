import type { Provider } from "./registry.js";

export const aider: Provider = {
  name: "aider",
  label: "Aider",
  paths: [".aider.conf.yml", "CONVENTIONS.md"],
};
