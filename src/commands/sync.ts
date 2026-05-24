import { resolve } from "node:path";
import { readLock } from "../core/lock.js";
import { exists, isDirectory } from "../utils/fs.js";
import * as log from "../utils/logger.js";

export interface SyncOptions {
  only?: string[];
  exclude?: string[];
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  quiet?: boolean;
  interactive?: boolean;
  link?: boolean;
}

export interface ResolvedPaths {
  source: string;
  destination: string;
  fromLock: boolean;
}

function expandPathArg(arg: string | undefined): string | undefined {
  if (!arg) return arg;

  const bracedMatch = arg.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  const prefixedMatch = arg.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
  const bareMatch = arg.match(/^[A-Z_][A-Z0-9_]*$/);
  const envName = bracedMatch?.[1] ?? prefixedMatch?.[1] ?? bareMatch?.[0];

  if (!envName || (bareMatch && !envName.includes("_"))) return arg;

  return process.env[envName] ?? arg;
}

export async function resolveSourceDest(
  sourceArg: string | undefined,
  destArg: string | undefined,
  commandName: string,
  configSource?: string,
): Promise<ResolvedPaths | null> {
  const sourcePath = expandPathArg(sourceArg);
  const destPath = expandPathArg(destArg);
  const configSourcePath = expandPathArg(configSource);

  if (destPath) {
    return {
      source: resolve(sourcePath ?? configSourcePath ?? "."),
      destination: resolve(destPath),
      fromLock: false,
    };
  }

  if (sourcePath) {
    const lock = await readLock(".");
    if (lock) {
      return {
        source: lock.source,
        destination: resolve(sourcePath),
        fromLock: false,
      };
    }
    return {
      source: resolve(configSourcePath ?? "."),
      destination: resolve(sourcePath),
      fromLock: false,
    };
  }

  // No args: try lock file
  const lock = await readLock(".");
  if (!lock) {
    log.error(`No destination specified and no aisync-lock.json found.`);
    log.log("");
    log.log("  Usage:");
    log.log(`    npx aisync ${commandName} [source] <destination>`);
    log.log("");
    log.log("  Examples:");
    log.log(`    npx aisync ${commandName} . ../feature-auth`);
    log.log(`    npx aisync ${commandName} ../main ../feature-auth`);
    process.exitCode = 1;
    return null;
  }

  return {
    source: lock.source,
    destination: resolve("."),
    fromLock: true,
  };
}

export async function validateSource(source: string): Promise<boolean> {
  if (!(await exists(source))) {
    log.error(`Source not found: ${source}`);
    process.exitCode = 1;
    return false;
  }

  if (!(await isDirectory(source))) {
    log.error(`Source is not a directory: ${source}`);
    process.exitCode = 1;
    return false;
  }

  return true;
}
