import type { Provider } from "./registry.js";

export const windsurf: Provider = {
  name: "windsurf",
  label: "Windsurf",
  paths: [".windsurf/", ".windsurfrules"],
};
