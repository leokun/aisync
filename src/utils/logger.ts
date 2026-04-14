import pc from "picocolors";

let verboseMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function log(message: string): void {
  console.log(message);
}

export function verbose(message: string): void {
  if (verboseMode) {
    console.log(pc.dim(message));
  }
}

export function success(message: string): void {
  console.log(pc.green(`  ✓ ${message}`));
}

export function warn(message: string): void {
  console.log(pc.yellow(`  ! ${message}`));
}

export function error(message: string): void {
  console.error(pc.red(`  Error: ${message}`));
}

export function item(name: string, status: string): void {
  console.log(`    ${name.padEnd(20)} ${status}`);
}

export function header(title: string): void {
  console.log();
  console.log(`  ${pc.bold("aisync")} ${pc.dim("-")} ${title}`);
  console.log();
}
