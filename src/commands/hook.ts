import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot, isGitRepo } from "../core/git.js";
import { exists } from "../utils/fs.js";
import * as log from "../utils/logger.js";

const HOOK_NAME = "post-checkout";
const HOOK_MARKER_START = "# >>> aisync hook >>>";
const HOOK_MARKER_END = "# <<< aisync hook <<<";

const HOOK_BODY = `${HOOK_MARKER_START}
# Auto-sync AI tool configs when checking out a new worktree.
# Managed by 'npx aisync hook'. Edit between markers will be overwritten.
if [ "$3" = "1" ]; then
  if command -v npx >/dev/null 2>&1; then
    npx --no-install aisync copy >/dev/null 2>&1 || true
  fi
fi
${HOOK_MARKER_END}
`;

const SHEBANG = "#!/bin/sh\n";

async function getHookPath(cwd: string): Promise<string> {
  const root = await getRepoRoot(cwd);
  return join(root, ".git", "hooks", HOOK_NAME);
}

function stripExistingBlock(content: string): string {
  const startIdx = content.indexOf(HOOK_MARKER_START);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(HOOK_MARKER_END, startIdx);
  if (endIdx === -1) return content;
  const tail = content.slice(endIdx + HOOK_MARKER_END.length);
  const head = content.slice(0, startIdx);
  return `${head.trimEnd()}\n${tail.trimStart()}`.trimEnd().concat("\n");
}

export async function hookInstall(cwd: string = "."): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    log.error("Not a git repository.");
    process.exitCode = 1;
    return;
  }

  const hookPath = await getHookPath(cwd);
  let existing = "";
  if (await exists(hookPath)) {
    existing = await readFile(hookPath, "utf-8");
  }

  if (existing.includes(HOOK_MARKER_START)) {
    const stripped = stripExistingBlock(existing);
    existing = stripped;
  }

  let next: string;
  if (!existing.trim()) {
    next = `${SHEBANG}\n${HOOK_BODY}`;
  } else if (existing.startsWith("#!")) {
    next = `${existing.trimEnd()}\n\n${HOOK_BODY}`;
  } else {
    next = `${SHEBANG}\n${existing.trimEnd()}\n\n${HOOK_BODY}`;
  }

  await writeFile(hookPath, next, "utf-8");
  await chmod(hookPath, 0o755);

  log.header("hook install");
  log.success(`Installed ${HOOK_NAME} hook at ${hookPath}`);
  console.log();
  console.log(
    "  New worktrees will run 'aisync copy' automatically after checkout.",
  );
  console.log();
}

export async function hookRemove(cwd: string = "."): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    log.error("Not a git repository.");
    process.exitCode = 1;
    return;
  }

  const hookPath = await getHookPath(cwd);
  if (!(await exists(hookPath))) {
    log.warn("No post-checkout hook found.");
    return;
  }

  const content = await readFile(hookPath, "utf-8");
  if (!content.includes(HOOK_MARKER_START)) {
    log.warn(
      "aisync block not found in post-checkout hook; nothing to remove.",
    );
    return;
  }

  const stripped = stripExistingBlock(content);
  const remainsTrivial =
    stripped.trim() === "" || stripped.trim() === "#!/bin/sh";

  log.header("hook remove");

  if (remainsTrivial) {
    await unlink(hookPath);
    log.success(`Removed ${HOOK_NAME} hook (${hookPath})`);
  } else {
    await writeFile(hookPath, stripped, "utf-8");
    log.success(`Removed aisync block from ${hookPath}`);
  }
  console.log();
}
