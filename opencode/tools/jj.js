import { tool } from "@opencode-ai/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      stdout: (result.stdout ?? "").trim(),
      stderr: (result.stderr ?? "").trim(),
    };
  } catch (error) {
    const stdout = (error.stdout ?? "").trim();
    const stderr = (error.stderr ?? "").trim();
    const details = [stderr, stdout].filter(Boolean).join("\n");
    const message = details || error.message || "Unknown command failure";
    throw new Error(`${command} ${args.join(" ")} failed: ${message}`);
  }
}

async function runJj(args, options = {}) {
  return run("jj", args, options);
}

async function tryJj(args, options = {}) {
  try {
    return await runJj(args, options);
  } catch {
    return null;
  }
}

async function getWorkspaceRoot(context) {
  const cwd = context.directory || context.worktree;
  const result = await tryJj(["workspace", "root"], { cwd });
  return result?.stdout?.trim() || null;
}

function normalizeIntent(intent) {
  return String(intent ?? "").trim();
}

function repoMode(root) {
  return root ? "jj" : "none";
}

function buildUsage(mode) {
  return {
    kind: "jj",
    operation: "usage",
    repoMode: mode,
    concepts: [
      {
        name: "working copy change vs commit",
        detail: "`@` is your current working-copy change; jj keeps editing that change until you intentionally start a new one.",
      },
      {
        name: "describe instead of amend",
        detail: "Use `jj describe -m ...` to name or rename the current change rather than reaching for `git commit --amend`.",
      },
      {
        name: "new starts the next change",
        detail: "Use `jj new` when you want to finish one logical change and continue in a fresh working-copy change.",
      },
      {
        name: "bookmarks publish refs",
        detail: "Bookmarks are the publishable ref abstraction; GitHub PR heads should line up with bookmark names.",
      },
      {
        name: "gh stays for GitHub",
        detail: "Keep local VCS work in `jj`, and use `gh` or `gh_repo_*` for PR, review, and GitHub state operations.",
      },
    ],
    recommendedCommands: [
      "jj status",
      "jj diff",
      "jj log",
      "jj describe -m \"message\"",
      "jj new -m \"next change\"",
      "jj bookmark create <name>",
      "jj git push --bookmark <name>",
    ],
    warnings: mode === "jj"
      ? ["Avoid raw local `git` commands in this workspace unless a GitHub integration path requires them internally."]
      : ["This workspace is not currently detected as jj-first."],
    nextSteps: [
      "Call `jj diagnose` before publishing if you are unsure what the current bookmark state is.",
      "Call `jj workflow` for task-oriented flows like split, publish, or review follow-up.",
    ],
  };
}

function buildMap(mode, intent) {
  const normalized = normalizeIntent(intent);
  const mappings = [
    {
      match: /git\s+status|\bstatus\b/i,
      concepts: ["working copy change vs commit"],
      commands: ["jj status"],
      nextSteps: ["Use `jj diff` next if you need the patch, not just the state summary."],
    },
    {
      match: /git\s+diff|\bdiff\b/i,
      concepts: ["working copy change vs commit"],
      commands: ["jj diff"],
      nextSteps: ["Add `-r <revset>` when you need a diff for a non-working-copy change."],
    },
    {
      match: /git\s+log|history|\blog\b/i,
      concepts: ["bookmarks publish refs"],
      commands: ["jj log", "jj log -r @::"],
      nextSteps: ["Prefer revsets and bookmark context instead of branch-only history views."],
    },
    {
      match: /git\s+commit\s+-m|commit message|rename current change|describe/i,
      concepts: ["describe instead of amend"],
      commands: ["jj describe -m \"message\""],
      nextSteps: ["If you are done with this change and want the next one, run `jj new` afterwards."],
    },
    {
      match: /git\s+commit\s+--amend|amend/i,
      concepts: ["describe instead of amend"],
      commands: ["jj describe", "jj squash --into @"],
      nextSteps: ["Use `jj describe` for message-only updates and `jj squash` when folding content from another change."],
    },
    {
      match: /checkout\s+-b|create branch|new branch|bookmark/i,
      concepts: ["bookmarks publish refs"],
      commands: ["jj bookmark create <name>", "jj bookmark set <name> -r @"],
      nextSteps: ["Use `create` for a new bookmark and `set` when you want an existing bookmark to move to `@`."],
    },
    {
      match: /git\s+push|publish|push origin/i,
      concepts: ["bookmarks publish refs", "gh stays for GitHub"],
      commands: [
        "jj git push --remote origin --bookmark <name>",
        "jj git push --change @",
        "jj git push --named <name>=@",
      ],
      nextSteps: [
        "Prefer `--bookmark` when a bookmark already points at `@`.",
        "Use `gh` after publishing when the next step is PR creation or review work.",
      ],
    },
    {
      match: /cherry-pick|rebase|stack|move history/i,
      concepts: ["working copy change vs commit"],
      commands: ["jj rebase -r <revset> -d <destination>", "jj split", "jj squash", "jj edit <revset>"],
      nextSteps: ["Pick the history-editing command that matches whether you are moving, splitting, combining, or resuming a change."],
    },
  ];

  const match = mappings.find((entry) => entry.match.test(normalized));

  return {
    kind: "jj",
    operation: "map",
    repoMode: mode,
    requestedIntent: normalized || null,
    concepts: match?.concepts ?? ["describe instead of amend", "bookmarks publish refs"],
    recommendedCommands: match?.commands ?? ["jj status", "jj log", "jj diagnose"],
    warnings: [
      ...(mode === "jj" ? [] : ["This workspace is not currently detected as jj-first."]),
      ...(match ? [] : ["The request did not match a known Git-style intent exactly; verify with `jj diagnose`."]),
    ],
    nextSteps: match?.nextSteps ?? ["Refine the task description if you want a closer command mapping."],
  };
}

function buildWorkflow(mode, topic) {
  const normalized = normalizeIntent(topic).toLowerCase();
  const flows = {
    inspect: {
      concepts: ["working copy change vs commit", "bookmarks publish refs"],
      commands: ["jj status", "jj diff", "jj log -r @::"],
      nextSteps: ["Use `jj diagnose` if you also need bookmark publish guidance."],
    },
    name: {
      concepts: ["describe instead of amend", "new starts the next change"],
      commands: ["jj describe -m \"message\"", "jj new -m \"next change\""],
      nextSteps: ["Use `jj new` only when you intentionally want a fresh working-copy change."],
    },
    split: {
      concepts: ["working copy change vs commit"],
      commands: ["jj split", "jj split -r @ path/to/file"],
      nextSteps: ["Review the result with `jj log -r @::` and rename each resulting change if needed."],
    },
    bookmark: {
      concepts: ["bookmarks publish refs"],
      commands: ["jj bookmark create <name>", "jj bookmark set <name> -r @", "jj bookmark list"],
      nextSteps: ["Make sure a bookmark points at `@` before you publish or create a PR."],
    },
    publish: {
      concepts: ["bookmarks publish refs", "gh stays for GitHub"],
      commands: [
        "jj git push --bookmark <name>",
        "jj git push --change @",
        "jj git push --named <name>=@",
      ],
      nextSteps: [
        "Prefer `--bookmark` when a bookmark already points at `@`.",
        "Switch to `gh` or `gh_repo_*` once the next step is PR work rather than local VCS work.",
      ],
    },
    review: {
      concepts: ["describe instead of amend", "bookmarks publish refs"],
      commands: ["jj status", "jj describe -m \"address review feedback\"", "jj git push --bookmark <name>"],
      nextSteps: ["Keep the local edit/publish cycle in `jj`, then use GitHub tools for thread replies and review requests."],
    },
  };

  const selected = flows[normalized] ?? flows.inspect;
  return {
    kind: "jj",
    operation: "workflow",
    repoMode: mode,
    workflow: normalized || "inspect",
    concepts: selected.concepts,
    recommendedCommands: selected.commands,
    warnings: [
      ...(mode === "jj" ? [] : ["This workspace is not currently detected as jj-first."]),
      ...(normalized === "publish" ? ["Publishing is ambiguous until a bookmark points at `@`." ] : []),
    ],
    nextSteps: selected.nextSteps,
  };
}

function parsePushDryRun(stdout, bookmarks) {
  const pendingBookmarks = [];
  for (const bookmark of bookmarks) {
    const escaped = bookmark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b(?:Move forward|Move sideways|Add|Delete|Forget)\\s+bookmark\\s+${escaped}\\b`);
    if (pattern.test(stdout)) {
      pendingBookmarks.push(bookmark);
    }
  }

  return {
    hasPendingChanges: pendingBookmarks.length > 0,
    pendingBookmarks,
    raw: stdout,
  };
}

async function inspectPublishState(cwd, bookmarks) {
  const base = {
    checked: false,
    remote: null,
    hasPendingChanges: false,
    pendingBookmarks: [],
    raw: null,
    error: null,
  };

  if (bookmarks.length === 0) {
    return base;
  }

  try {
    const { stdout: remoteStdout } = await runJj(["git", "remote", "list"], { cwd });
    const remotes = remoteStdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/, 2)[0])
      .filter(Boolean);
    const remote = remotes.includes("origin") ? "origin" : (remotes[0] ?? "origin");
    const args = ["git", "push", "--remote", remote, "--dry-run"];
    for (const bookmark of bookmarks) {
      args.push("--bookmark", bookmark);
    }
    const { stdout } = await runJj(args, { cwd });
    return {
      ...base,
      checked: true,
      remote,
      ...parsePushDryRun(stdout, bookmarks),
    };
  } catch (error) {
    return {
      ...base,
      checked: true,
      error: error.message,
    };
  }
}

function buildPublishStatus(statusStdout, bookmarks, inspection) {
  const hasUncommittedChanges = !statusStdout.includes("The working copy is clean");
  const ambiguous = bookmarks.length === 0;
  const hasCommittedUnpublishedChanges =
    !hasUncommittedChanges && !ambiguous && Boolean(inspection?.hasPendingChanges);
  const warnings = [];
  const nextSteps = [];
  let state = "ready";

  if (hasUncommittedChanges) {
    state = ambiguous ? "needs_commit_and_bookmark" : "needs_commit";
    nextSteps.push("Inspect the working copy with `jj status` and `jj diff`.");
    nextSteps.push("Use `jj describe -m ...` to record or rename the current change.");
  }

  if (ambiguous) {
    warnings.push("No bookmark points at `@`, so the current change cannot be published safely yet.");
    nextSteps.push("Create or move a bookmark with `jj bookmark create <name>` or `jj bookmark set <name> -r @`.");
    if (!hasUncommittedChanges) {
      state = "needs_bookmark";
    }
  } else if (inspection?.error) {
    warnings.push(`Could not confirm bookmark publish state: ${inspection.error}`);
    if (!hasUncommittedChanges) {
      state = "publish_check_failed";
    }
  } else if (hasCommittedUnpublishedChanges) {
    state = "needs_publish";
    nextSteps.push("Publish the current bookmark with `jj git push --bookmark <name>`.");
  }

  return {
    vcs: "jj",
    publishKind: "bookmark",
    state,
    ambiguous,
    bookmarks,
    primaryRef: bookmarks[0] ?? null,
    remote: inspection?.remote ?? null,
    checked: Boolean(inspection?.checked),
    pendingBookmarks: inspection?.pendingBookmarks ?? [],
    hasUncommittedChanges,
    hasCommittedUnpublishedChanges,
    hasUnpushedCommits:
      hasUncommittedChanges || ambiguous || hasCommittedUnpublishedChanges || Boolean(inspection?.error),
    needsCommitBeforePush: hasUncommittedChanges,
    ready: !hasUncommittedChanges && !ambiguous && !hasCommittedUnpublishedChanges && !inspection?.error,
    warnings,
    nextSteps,
    dryRunOutput: inspection?.raw ?? null,
  };
}

async function buildDiagnose(context) {
  const root = await getWorkspaceRoot(context);
  if (!root) {
    return {
      kind: "jj",
      operation: "diagnose",
      repoMode: "none",
      workspaceRoot: null,
      concepts: [],
      recommendedCommands: [],
      warnings: ["`jj workspace root` did not succeed in the current workspace."],
      nextSteps: ["Run this tool from inside a jj workspace if you want bookmark-aware guidance."],
    };
  }

  const [statusResult, logResult, bookmarkResult, remoteResult] = await Promise.all([
    runJj(["status"], { cwd: root }),
    runJj(["log", "-r", "@", "--no-graph", "-T", "change_id.short() ++ \" \" ++ commit_id.short() ++ \" \" ++ description"], { cwd: root }),
    runJj(["log", "-r", "@", "--no-graph", "-T", 'bookmarks.map(|b| b.name()).join("\\n") ++ "\\n"'], { cwd: root }),
    runJj(["git", "remote", "list"], { cwd: root }),
  ]);

  const bookmarks = bookmarkResult.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const inspection = await inspectPublishState(root, bookmarks);
  const publishStatus = buildPublishStatus(statusResult.stdout, bookmarks, inspection);
  const remotes = remoteResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(/\s+/);
      return { name, url: rest.join(" ") };
    });

  const warnings = [...publishStatus.warnings];
  if (publishStatus.hasCommittedUnpublishedChanges && bookmarks.length > 1) {
    warnings.push("Multiple bookmarks point at `@`; publishing all of them may update more refs than you intend.");
  }

  return {
    kind: "jj",
    operation: "diagnose",
    repoMode: "jj",
    workspaceRoot: root,
    concepts: ["working copy change vs commit", "bookmarks publish refs", "gh stays for GitHub"],
    currentChange: {
      summary: logResult.stdout.trim() || null,
      bookmarks,
    },
    remotes,
    workingCopyStatus: statusResult.stdout,
    publishStatus,
    recommendedCommands: publishStatus.nextSteps.length > 0
      ? publishStatus.nextSteps
          .map((step) => {
            const match = step.match(/`([^`]+)`/);
            return match?.[1] ?? null;
          })
          .filter(Boolean)
      : ["jj status", "jj log -r @", "jj bookmark list"],
    warnings,
    nextSteps: publishStatus.nextSteps.length > 0
      ? publishStatus.nextSteps
      : ["No local publish action is required right now; use `gh` or `gh_repo_*` for PR operations."],
  };
}

export default tool({
  description: "Advisory Jujutsu workflow guide for jj-first local VCS work.",
  args: {
    operation: tool.schema
      .enum(["usage", "map", "workflow", "diagnose"])
      .describe("Which kind of jj guidance to return."),
    intent: tool.schema
      .string()
      .optional()
      .describe("Git-style intent or task description to translate or explain."),
  },
  async execute(args, context) {
    const root = await getWorkspaceRoot(context);
    const mode = repoMode(root);

    if (args.operation === "usage") {
      return JSON.stringify(buildUsage(mode), null, 2);
    }

    if (args.operation === "map") {
      return JSON.stringify(buildMap(mode, args.intent), null, 2);
    }

    if (args.operation === "workflow") {
      return JSON.stringify(buildWorkflow(mode, args.intent), null, 2);
    }

    return JSON.stringify(await buildDiagnose(context), null, 2);
  },
});
