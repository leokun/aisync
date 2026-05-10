import { resolve } from "node:path";
import pc from "picocolors";
import {
  DoctorError,
  type DoctorReport,
  diagnose,
  type ItemStatus,
} from "../core/doctor.js";
import * as log from "../utils/logger.js";

interface DoctorOptions {
  json?: boolean;
  verbose?: boolean;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  synced: "synced",
  stale: "stale",
  drift: "drift",
  conflict: "conflict",
  "missing-source": "missing-source",
  "missing-dest": "missing-dest",
};

const STATUS_DESCRIPTION: Record<ItemStatus, string> = {
  synced: "",
  stale: "source updated since last sync",
  drift: "local changes in destination",
  conflict: "modified in both source and destination",
  "missing-source": "source path no longer exists",
  "missing-dest": "destination path was removed",
};

export async function doctor(options: DoctorOptions): Promise<void> {
  log.setVerbose(Boolean(options.verbose));
  const destination = resolve(".");

  let report: DoctorReport;
  try {
    report = await diagnose(destination);
  } catch (err) {
    if (err instanceof DoctorError) {
      log.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    if (report.counts.conflict > 0) process.exitCode = 1;
    return;
  }

  printReport(report);

  if (report.counts.conflict > 0) {
    process.exitCode = 1;
  }
}

function printReport(report: DoctorReport): void {
  log.header("doctor");

  console.log(`  Source: ${report.source}`);
  console.log(`  Destination: ${report.destination}`);
  console.log(`  Last sync: ${report.lastSync}`);
  console.log(`  Mode: ${report.mode}`);
  console.log();

  if (report.items.length === 0) {
    console.log("  Lock file has no items.");
    console.log();
    return;
  }

  for (const item of report.items) {
    const symbol = symbolFor(item.status);
    const label = STATUS_LABEL[item.status];
    const desc = STATUS_DESCRIPTION[item.status];
    const right = desc
      ? `${symbol} ${label}  ${pc.dim(desc)}`
      : `${symbol} ${label}`;
    log.item(item.path, right);
  }
  console.log();

  const summary = formatSummary(report.counts);
  console.log(`  Summary: ${summary}`);

  const reco = recommendation(report);
  if (reco) {
    console.log(`  ${reco}`);
  }
  console.log();
}

function symbolFor(status: ItemStatus): string {
  switch (status) {
    case "synced":
      return pc.green("✓");
    case "stale":
    case "drift":
    case "missing-source":
    case "missing-dest":
      return pc.yellow("!");
    case "conflict":
      return pc.red("✗");
  }
}

function formatSummary(counts: Record<ItemStatus, number>): string {
  const parts: string[] = [];
  for (const status of Object.keys(counts) as ItemStatus[]) {
    if (counts[status] > 0) {
      parts.push(`${counts[status]} ${STATUS_LABEL[status]}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "no items";
}

function recommendation(report: DoctorReport): string | null {
  const { counts } = report;
  const lines: string[] = [];
  if (counts.stale > 0 || counts["missing-dest"] > 0) {
    lines.push("Run `aisync copy` (or `aisync link`) to refresh.");
  }
  if (counts.conflict > 0) {
    lines.push("Conflicts need manual review before re-syncing.");
  }
  if (counts.drift > 0 && counts.conflict === 0) {
    lines.push(
      "Drift detected: dest has local edits. Use `aisync copy --force` to overwrite.",
    );
  }
  if (counts["missing-source"] > 0) {
    lines.push(
      "Some source paths were removed: edit the source or run `aisync clean`.",
    );
  }
  return lines.length > 0 ? lines.join(" ") : null;
}
