import { cancel, isCancel, multiselect } from "@clack/prompts";
import type { Provider } from "../providers/registry.js";
import { isTTY } from "./platform.js";

export async function selectProviders(
  detected: Provider[],
): Promise<Provider[]> {
  if (!isTTY()) return detected;
  if (detected.length <= 1) return detected;

  const result = await multiselect({
    message: "Which providers to sync?",
    options: detected.map((p) => ({ label: p.label, value: p.name })),
    initialValues: detected.map((p) => p.name),
    required: true,
  });

  if (isCancel(result)) {
    cancel("Cancelled");
    process.exit(0);
  }

  const selected = result as string[];
  return detected.filter((p) => selected.includes(p.name));
}
