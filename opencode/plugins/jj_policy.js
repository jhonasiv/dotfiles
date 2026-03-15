import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TO_JJ_EQUIVALENTS = {
  status: "Use `jj status` instead.",
  diff: "Use `jj diff` instead.",
  log: "Use `jj log` instead.",
  commit:
    "Use `jj describe -m ...` to name the current change, or `jj new` when you want to start the next change.",
  push: "Use `jj git push --bookmark <name>` after a bookmark points at `@`.",
  checkout:
    "Use `jj edit <revset>` when you mean to resume a change, or `jj bookmark create/set` when you mean ref management.",
  branch: "Use `jj bookmark list`, `jj bookmark create`, or `jj bookmark set` instead.",
  rebase: "Use `jj rebase` instead.",
  merge: "Use `jj new <parents>` or `jj rebase` depending on the history edit you need.",
};

function appendUnique(base, addition) {
  if (!addition) {
    return base;
  }

  if (!base) {
    return addition;
  }

  return base.includes(addition) ? base : `${base} ${addition}`;
}

function resolveCwd(baseDirectory, baseWorktree, candidate) {
  const fallback = baseDirectory || baseWorktree || process.cwd();
  if (!candidate) {
    return fallback;
  }

  if (path.isAbsolute(candidate)) {
    return candidate;
  }

  return path.resolve(fallback, candidate);
}

async function tryExec(command, args, cwd) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      stdout: (result.stdout ?? "").trim(),
      stderr: (result.stderr ?? "").trim(),
    };
  } catch {
    return null;
  }
}

function findBlockedGitSubcommand(command) {
  const match = String(command ?? "").match(
    /(?:^|(?:&&|\|\||;)\s*)(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+|env\s+)*git(?:\s+(?:-C|-c)\s+\S+|\s+--[^\s]+(?:=\S+)?)*\s+(status|diff|log|commit|push|checkout|branch|rebase|merge)\b/i,
  );

  return match?.[1]?.toLowerCase() ?? null;
}

export const JjPolicyPlugin = async ({ directory, worktree }) => {
  const repoCache = new Map();

  async function detectJjRoot(candidateCwd) {
    const cwd = resolveCwd(directory, worktree, candidateCwd);
    if (repoCache.has(cwd)) {
      return repoCache.get(cwd);
    }

    const result = await tryExec("jj", ["workspace", "root"], cwd);
    const root = result?.stdout || null;
    repoCache.set(cwd, root);
    return root;
  }

  async function isJjRepo(candidateCwd) {
    return Boolean(await detectJjRoot(candidateCwd));
  }

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      if (!(await isJjRepo(directory || worktree))) {
        return;
      }

      output.system.push(
        "This workspace is jj-first. Use `jj` for local status, diff, history, change editing, bookmarks, and publish steps. Use `gh` or `gh_repo_*` for GitHub and pull request operations. Avoid raw local `git` commands here, prefer bookmark terminology over branch terminology, and call the `jj` tool when local workflow intent is unclear.",
      );
    },
    "tool.definition": async (input, output) => {
      if (input.toolID !== "bash") {
        return;
      }

      if (!(await isJjRepo(directory || worktree))) {
        return;
      }

      const note =
        "In jj repos, prefer `jj status`, `jj diff`, `jj log`, `jj describe`, `jj bookmark create`, `jj bookmark set`, and `jj git push --bookmark <name>` for local VCS work. Use `gh` for GitHub operations.";

      output.description = appendUnique(output.description, note);

      const commandSchema = output.parameters?.properties?.command;
      if (commandSchema && typeof commandSchema.description === "string") {
        commandSchema.description = appendUnique(
          commandSchema.description,
          "When this workspace supports Jujutsu, avoid raw local git commands and prefer jj-native commands.",
        );
      }

      const descriptionSchema = output.parameters?.properties?.description;
      if (descriptionSchema && typeof descriptionSchema.description === "string") {
        descriptionSchema.description = appendUnique(
          descriptionSchema.description,
          "Use jj/bookmark wording instead of git/branch wording when the repo is jj-first.",
        );
      }
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") {
        return;
      }

      const command = String(output.args?.command ?? "");
      const subcommand = findBlockedGitSubcommand(command);
      if (!subcommand) {
        return;
      }

      const cwd = output.args?.cwd ?? output.args?.workdir ?? directory ?? worktree;
      if (!(await isJjRepo(cwd))) {
        return;
      }

      const guidance = GIT_TO_JJ_EQUIVALENTS[subcommand] ?? "Use jj-native local VCS commands instead.";
      throw new Error(
        `Raw local git commands are blocked in jj repos. ${guidance} If the mapping is unclear, call the \`jj\` tool with \`operation: "map"\`, \`"workflow"\`, or \`"diagnose"\` first.`,
      );
    },
  };
};

export default JjPolicyPlugin;
