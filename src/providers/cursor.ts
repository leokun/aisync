import type { Provider } from "./registry.js";

export const cursor: Provider = {
  name: "cursor",
  label: "Cursor",
  paths: [".cursor/", ".cursorrules"],
};
