import type { Provider } from "./registry.js";

export const copilot: Provider = {
  name: "copilot",
  label: "GitHub Copilot",
  paths: [".github/copilot/"],
};
