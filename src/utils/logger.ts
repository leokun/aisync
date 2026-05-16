import pc from "picocolors";

let verboseMode = false;
let quietMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function setQuiet(enabled: boolean): void {
  quietMode = enabled;
}

export function log(message: string): void {
  if (quietMode) return;
  console.log(message);
}

export function verbose(message: string): void {
  if (quietMode) return;
  if (verboseMode) {
    console.log(pc.dim(message));
  }
}

export function success(message: string): void {
  if (quietMode) return;
  console.log(pc.green(`  ✓ ${message}`));
}

export function warn(message: string): void {
  console.log(pc.yellow(`  ! ${message}`));
}

export function error(message: string): void {
  console.error(pc.red(`  Error: ${message}`));
}

export function item(name: string, status: string): void {
  if (quietMode) return;
  console.log(`    ${name.padEnd(20)} ${status}`);
}

export function header(title: string): void {
  if (quietMode) return;
  console.log();
  console.log(`  ${pc.bold("aisync")} ${pc.dim("-")} ${title}`);
  console.log();
}
