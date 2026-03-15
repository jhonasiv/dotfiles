import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { tool } from "@opencode-ai/plugin";
import {
  DEFAULT_REVIEWERS,
  REVIEW_LOOP_PHASES,
  chooseWorkflowAction,
  evaluateReviewerSatisfaction,
  getBlockingWorkflowStopReasons,
  getChecksSummary,
  getPublishStatus,
  getReviewLoopPhase,
  getReviewerUpdateSummary,
  getWorkflowNextActions,
  getWorkflowStopReasons,
  hasNewReviewActivity,
  isApprovalComment,
  normalizeRequestedReviewers,
  syncReviewerUpdateState,
} from "./gh_repo_workflow_logic.mjs";

const execFileAsync = promisify(execFile);

const CONFIG_DIR = path.join(os.homedir(), ".config", "opencode");
const STATE_FILE = path.join(CONFIG_DIR, "gh-workflow-state.json");
const STATE_LOCK_FILE = `${STATE_FILE}.lock`;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const STATE_LOCK_TIMEOUT_MS = 5000;
const STATE_LOCK_RETRY_MS = 50;
const STATE_LOCK_STALE_MS = 30000;
const DEFAULT_PR_FIELDS = [
  "number",
  "title",
  "body",
  "author",
  "state",
  "isDraft",
  "reviewDecision",
  "reviewRequests",
  "latestReviews",
  "reviews",
  "mergeStateStatus",
  "statusCheckRollup",
  "baseRefName",
  "headRefName",
  "comments",
  "updatedAt",
  "url",
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeRepo(repo) {
  if (!repo || typeof repo !== "string") {
    throw new Error("A GitHub repository in owner/name format is required.");
  }

  let normalized = repo.trim();
  normalized = normalized.replace(/^https?:\/\/github\.com\//, "");
  normalized = normalized.replace(/^ssh:\/\/git@github\.com\//, "");
  normalized = normalized.replace(/^git@github\.com:/, "");
  normalized = normalized.replace(/^github\.com\//, "");
  normalized = normalized.replace(/\.git$/, "");
  normalized = normalized.replace(/^\/+|\/+$/g, "");

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new Error(`Invalid GitHub repository: ${repo}`);
  }

  return normalized;
}

function splitRepo(repo) {
  const normalized = normalizeRepo(repo);
  const [owner, name] = normalized.split("/");
  return { owner, name, repo: normalized };
}

function defaultState() {
  return {
    version: 1,
    whitelist: {},
    sessions: {},
  };
}

function defaultSession() {
  return {
    configured: false,
    pushesRemaining: 0,
    pushesUsed: 0,
    reviewRoundsRemaining: 0,
    reviewRoundsUsed: 0,
    awaitingReviewUpdates: false,
    lastReviewRequestedAt: null,
    stopWhenNoUnresolvedThreads: false,
    stopWhenApproved: false,
    stopWhenChecksPass: false,
    defaultReviewers: [...DEFAULT_REVIEWERS],
    notes: null,
    // Review-loop fields
    reviewLoopActive: false,
    reviewLoopPhase: null,
    prNumber: null,
    prUrl: null,
    selectedReviewers: null,
    lastPublishedChangeAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function cloneDefaultReviewers() {
  return [...DEFAULT_REVIEWERS];
}

function normalizeReviewerList(reviewers) {
  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    return cloneDefaultReviewers();
  }

  return reviewers
    .map((reviewer) => String(reviewer).trim())
    .filter(Boolean);
}

function touchSession(session) {
  session.updatedAt = nowIso();
}

function pruneState(state) {
  const cutoff = Date.now() - SESSION_MAX_AGE_MS;

  for (const [sessionId, repos] of Object.entries(state.sessions ?? {})) {
    for (const [repo, session] of Object.entries(repos ?? {})) {
      const updatedAt = Date.parse(session?.updatedAt ?? session?.createdAt ?? 0);
      if (!updatedAt || updatedAt < cutoff) {
        delete state.sessions[sessionId][repo];
      }
    }

    if (Object.keys(state.sessions[sessionId] ?? {}).length === 0) {
      delete state.sessions[sessionId];
    }
  }

  return state;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStateFile() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const state = {
      version: 1,
      whitelist: parsed?.whitelist ?? {},
      sessions: parsed?.sessions ?? {},
    };

    return pruneState(state);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return defaultState();
    }

    throw new Error(`Could not read GitHub workflow state: ${error.message}`);
  }
}

async function writeStateFile(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tempFile = `${STATE_FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, STATE_FILE);
}

async function acquireStateLock() {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const token = `${process.pid}:${Date.now()}:${randomUUID()}`;
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await fs.open(STATE_LOCK_FILE, "wx");
      await handle.writeFile(`${token}\n`, "utf8");
      await handle.close();

      return async () => {
        try {
          const raw = await fs.readFile(STATE_LOCK_FILE, "utf8");
          if (raw.trim() !== token) {
            return;
          }
        } catch (error) {
          if (error?.code === "ENOENT") {
            return;
          }

          throw new Error(`Could not read GitHub workflow lock: ${error.message}`);
        }

        try {
          await fs.unlink(STATE_LOCK_FILE);
        } catch (error) {
          if (error?.code !== "ENOENT") {
            throw new Error(`Could not remove GitHub workflow lock: ${error.message}`);
          }
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw new Error(`Could not acquire GitHub workflow lock: ${error.message}`);
      }

      try {
        const stat = await fs.stat(STATE_LOCK_FILE);
        if (Date.now() - stat.mtimeMs > STATE_LOCK_STALE_MS) {
          await fs.unlink(STATE_LOCK_FILE);
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") {
          throw new Error(`Could not inspect GitHub workflow lock: ${statError.message}`);
        }

        continue;
      }

      if (Date.now() - startedAt >= STATE_LOCK_TIMEOUT_MS) {
        throw new Error("Timed out waiting for GitHub workflow state lock.");
      }

      await sleep(STATE_LOCK_RETRY_MS);
    }
  }
}

async function loadState() {
  return readStateFile();
}

async function updateState(mutator) {
  const releaseLock = await acquireStateLock();

  try {
    const state = await readStateFile();
    const result = await mutator(state);
    const nextState = pruneState(state);
    await writeStateFile(nextState);
    return {
      state: nextState,
      result,
    };
  } finally {
    await releaseLock();
  }
}

async function persistStateMutation(access, mutator) {
  const { state: nextState, result } = await updateState(async (latestState) => {
    if (access?.state) {
      access.state = latestState;
    }

    const latestSession = access?.repo ? getSession(latestState, access.context.sessionID, access.repo) : null;
    if (access) {
      access.session = latestSession;
    }

    return mutator(latestState, latestSession);
  });

  if (access) {
    access.state = nextState;
    access.session = access.repo ? getSession(nextState, access.context.sessionID, access.repo) : null;
  }

  return result;
}

async function syncReviewerUpdatesAndPersist(access, reviewerUpdates) {
  if (!syncReviewerUpdateState(access.session, reviewerUpdates)) {
    return false;
  }

  await persistStateMutation(access, async (state) => {
    const sessionData = ensureSession(state, access.context.sessionID, access.repo);
    sessionData.awaitingReviewUpdates = false;
    touchSession(sessionData);
  });

  reviewerUpdates.awaiting = false;
  return true;
}

function getSession(state, sessionId, repo) {
  return state.sessions?.[sessionId]?.[repo] ?? null;
}

function ensureSession(state, sessionId, repo) {
  state.sessions[sessionId] ??= {};
  state.sessions[sessionId][repo] ??= defaultSession();
  return state.sessions[sessionId][repo];
}

function sessionSnapshot(session, repo) {
  return {
    repo,
    active: Boolean(session),
    configured: session?.configured ?? false,
    pushesRemaining: session?.pushesRemaining ?? 0,
    pushesUsed: session?.pushesUsed ?? 0,
    reviewRoundsRemaining: session?.reviewRoundsRemaining ?? 0,
    reviewRoundsUsed: session?.reviewRoundsUsed ?? 0,
    awaitingReviewUpdates: session?.awaitingReviewUpdates ?? false,
    lastReviewRequestedAt: session?.lastReviewRequestedAt ?? null,
    stopWhenNoUnresolvedThreads: session?.stopWhenNoUnresolvedThreads ?? false,
    stopWhenApproved: session?.stopWhenApproved ?? false,
    stopWhenChecksPass: session?.stopWhenChecksPass ?? false,
    defaultReviewers: session?.defaultReviewers ?? cloneDefaultReviewers(),
    notes: session?.notes ?? null,
    reviewLoopActive: session?.reviewLoopActive ?? false,
    reviewLoopPhase: session?.reviewLoopPhase ?? null,
    prNumber: session?.prNumber ?? null,
    prUrl: session?.prUrl ?? null,
    selectedReviewers: session?.selectedReviewers ?? null,
    lastPublishedChangeAt: session?.lastPublishedChangeAt ?? null,
    createdAt: session?.createdAt ?? null,
    updatedAt: session?.updatedAt ?? null,
  };
}

function whitelistSnapshot(state, repo) {
  const entry = state.whitelist?.[repo] ?? null;
  return {
    repo,
    whitelisted: Boolean(entry),
    addedAt: entry?.addedAt ?? null,
  };
}

function isMissingCommentResourceError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("not found") || message.includes("404");
}

function stringify(data) {
  return JSON.stringify(data, null, 2);
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

async function run(command, args, options = {}) {
  const env = {
    ...process.env,
    GH_PAGER: "cat",
    GH_NO_UPDATE_NOTIFIER: "1",
  };

  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      env,
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
    throw new Error(`${formatCommand(command, args)} failed: ${message}`);
  }
}

async function runGh(args, options = {}) {
  const fullArgs = [];
  if (options.repo && options.useRepoFlag !== false) {
    fullArgs.push("-R", normalizeRepo(options.repo));
  }
  fullArgs.push(...args);
  return run("gh", fullArgs, { cwd: options.cwd });
}

async function runGhJson(args, options = {}) {
  const { stdout } = await runGh(args, options);
  if (!stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Could not parse JSON from gh output: ${error.message}`);
  }
}

async function runJj(args, options = {}) {
  return run("jj", args, { cwd: options.cwd });
}

async function tryJj(args, options = {}) {
  try {
    return await runJj(args, options);
  } catch {
    return null;
  }
}

async function runGit(args, options = {}) {
  return run("git", args, { cwd: options.cwd });
}

async function tryGit(args, options = {}) {
  try {
    return await runGit(args, options);
  } catch {
    return null;
  }
}

async function detectVcs(context) {
  const startCwd = context.directory || context.worktree;

  const jjRoot = await tryJj(["workspace", "root"], { cwd: startCwd });
  if (jjRoot?.stdout) {
    return {
      kind: "jj",
      root: jjRoot.stdout,
    };
  }

  const gitRoot = await tryGit(["rev-parse", "--show-toplevel"], { cwd: startCwd });
  if (gitRoot?.stdout) {
    return {
      kind: "git",
      root: gitRoot.stdout,
    };
  }

  return {
    kind: "none",
    root: context.worktree || context.directory,
  };
}

function parseRemoteList(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(/\s+/);
      return {
        name,
        url: rest.join(" "),
      };
    })
    .filter((remote) => remote.name && remote.url);
}

function pickRemote(remotes, preferred) {
  if (!Array.isArray(remotes) || remotes.length === 0) {
    return null;
  }

  if (preferred) {
    const match = remotes.find((remote) => remote.name === preferred);
    if (match) {
      return match;
    }
  }

  return remotes.find((remote) => remote.name === "origin") ?? remotes[0];
}

async function detectCurrentRepo(context) {
  const vcs = await detectVcs(context);

  if (vcs.kind === "jj") {
    const remoteList = await tryJj(["git", "remote", "list"], { cwd: vcs.root });
    const remote = pickRemote(parseRemoteList(remoteList?.stdout ?? ""), "origin");

    if (remote?.url) {
      try {
        return normalizeRepo(remote.url);
      } catch {
        return null;
      }
    }
  }

  if (vcs.kind === "git") {
    const remote = await tryGit(["remote", "get-url", "origin"], {
      cwd: vcs.root,
    });

    if (remote?.stdout) {
      try {
        return normalizeRepo(remote.stdout);
      } catch {
        return null;
      }
    }
  }

  try {
    const data = await runGhJson(["repo", "view", "--json", "nameWithOwner"], {
      cwd: vcs.root,
    });
    return normalizeRepo(data.nameWithOwner);
  } catch {
    return null;
  }
}

async function ensureRepoWhitelisted(context, state, repo) {
  if (state.whitelist[repo]) {
    return;
  }

  try {
    await context.ask({
      permission: "gh_repo_whitelist",
      patterns: [repo],
      always: [],
      metadata: {
        repo,
        action: "add_to_whitelist",
        message: `Add ${repo} to the persistent GitHub workflow whitelist.`,
      },
    });
  } catch {
    throw new Error(`GitHub workflow access was not approved for ${repo}.`);
  }

  state.whitelist[repo] = {
    addedAt: nowIso(),
  };
}

async function resolveRepoAccess(context, repo, options = {}) {
  let state = await loadState();
  const vcs = await detectVcs(context);
  const currentRepo = await detectCurrentRepo(context);
  const targetRepo = repo ? normalizeRepo(repo) : currentRepo;

  if (!targetRepo) {
    throw new Error(
      "Could not determine the current GitHub repository. Pass repo as owner/name or run inside a GitHub checkout.",
    );
  }

  if (options.requireCurrentRepo && currentRepo && currentRepo !== targetRepo) {
    throw new Error(`This operation only supports the current checkout repo (${currentRepo}).`);
  }

  if (options.ensureWhitelisted !== false) {
    let changed = false;
    const updated = await updateState(async (latestState) => {
      state = latestState;
      const hadWhitelist = Boolean(latestState.whitelist[targetRepo]);
      await ensureRepoWhitelisted(context, latestState, targetRepo);
      changed = !hadWhitelist && Boolean(latestState.whitelist[targetRepo]);
    });
    if (changed) {
      state = updated.state;
    }
  }

  return {
    state,
    repo: targetRepo,
    currentRepo,
    context,
    vcs,
    session: getSession(state, context.sessionID, targetRepo),
  };
}

function matchesReviewer(login, reviewerFilter) {
  if (!reviewerFilter) {
    return true;
  }

  const normalizedLogin = String(login ?? "").toLowerCase();
  const normalizedFilter = String(reviewerFilter).replace(/^@/, "").toLowerCase();

  return normalizedLogin.includes(normalizedFilter);
}

function filterReviewsByReviewer(reviews, reviewerFilter) {
  if (!Array.isArray(reviews) || !reviewerFilter) {
    return reviews ?? [];
  }

  return reviews.filter((review) => matchesReviewer(review?.author?.login, reviewerFilter));
}

function filterThreadsByReviewer(threads, reviewerFilter) {
  if (!Array.isArray(threads) || !reviewerFilter) {
    return threads ?? [];
  }

  return threads.filter((thread) =>
    Array.isArray(thread.comments) &&
    thread.comments.some((comment) => matchesReviewer(comment?.author, reviewerFilter)),
  );
}

async function getCurrentPullRequest(repo, cwd) {
  try {
    return await runGhJson(["pr", "view", "--json", DEFAULT_PR_FIELDS.join(",")], {
      cwd,
      repo,
    });
  } catch {
    return null;
  }
}

async function getCurrentJjBookmarks(cwd) {
  const { stdout } = await runJj(
    ["log", "-r", "@", "--no-graph", "-T", 'bookmarks.map(|b| b.name()).join("\\n") ++ "\\n"'],
    { cwd },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function getJjRemotes(cwd) {
  const result = await runJj(["git", "remote", "list"], { cwd });
  return parseRemoteList(result.stdout);
}

async function findPullRequestByHead(repo, headRefName, cwd) {
  const items = await runGhJson(
    [
      "pr",
      "list",
      "--state",
      "all",
      "--head",
      headRefName,
      "--limit",
      "1",
      "--json",
      DEFAULT_PR_FIELDS.join(","),
    ],
    { cwd, repo },
  );

  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

async function getCurrentPullRequestForVcs(access, context) {
  if (access.vcs.kind === "jj") {
    const bookmarks = await getCurrentJjBookmarks(access.vcs.root);

    for (const bookmark of bookmarks) {
      const pullRequest = await findPullRequestByHead(access.repo, bookmark, access.vcs.root);
      if (pullRequest) {
        return {
          ...pullRequest,
          detectedHeadRefName: bookmark,
          detectedBy: "jj_bookmark",
        };
      }
    }

    return null;
  }

  return getCurrentPullRequest(access.repo, access.vcs.root || context.worktree);
}

function parsePrNumber(pr) {
  if (pr === undefined || pr === null) {
    return null;
  }

  const parsed = Number(pr);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid pull request number: ${pr}`);
  }

  return parsed;
}

async function requirePrNumber(repo, cwd, pr) {
  const parsed = parsePrNumber(pr);
  if (parsed) {
    return parsed;
  }

  const current = await getCurrentPullRequest(repo, cwd);
  if (!current?.number) {
    throw new Error(
      "Could not determine the pull request for the current branch. Pass pr explicitly.",
    );
  }

  return current.number;
}

async function requirePrNumberForAccess(access, context, pr) {
  const parsed = parsePrNumber(pr);
  if (parsed) {
    return parsed;
  }

  const current = await getCurrentPullRequestForVcs(access, context);
  if (!current?.number) {
    throw new Error(
      "Could not determine the pull request for the current branch or jj bookmark. Pass pr explicitly.",
    );
  }

  return current.number;
}

async function getPrView(repo, cwd, pr, fields = DEFAULT_PR_FIELDS) {
  const args = ["pr", "view"];
  const prNumber = parsePrNumber(pr);
  if (prNumber) {
    args.push(String(prNumber));
  }
  args.push("--json", fields.join(","));

  return runGhJson(args, { cwd, repo });
}

async function getPrViewForAccess(access, context, pr, fields = DEFAULT_PR_FIELDS) {
  const prNumber = parsePrNumber(pr);
  if (prNumber) {
    return getPrView(access.repo, access.vcs.root || context.worktree, prNumber, fields);
  }

  const current = await getCurrentPullRequestForVcs(access, context);
  if (!current?.number) {
    throw new Error(
      "Could not determine the pull request for the current branch or jj bookmark. Pass pr explicitly.",
    );
  }

  return getPrView(access.repo, access.vcs.root || context.worktree, current.number, fields);
}

async function listPullRequests(repo, cwd, state, limit) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  return runGhJson(
    [
      "pr",
      "list",
      "--state",
      state || "open",
      "--limit",
      String(safeLimit),
      "--json",
      [
        "number",
        "title",
        "author",
        "state",
        "isDraft",
        "reviewDecision",
        "mergeStateStatus",
        "baseRefName",
        "headRefName",
        "updatedAt",
        "url",
      ].join(","),
    ],
    { cwd, repo },
  );
}

async function fetchReviewThreads(repo, prNumber, cwd) {
  const { owner, name } = splitRepo(repo);
  const query = `
    query($owner: String!, $name: String!, $number: Int!, $after: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          number
          title
          url
          reviewThreads(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              isResolved
              isOutdated
              isCollapsed
              path
              line
              originalLine
              startLine
              originalStartLine
              diffSide
              comments(first: 50) {
                nodes {
                  id
                  databaseId
                  body
                  createdAt
                  url
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  let after = null;
  let pullRequest = null;
  const threads = [];

  while (true) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `number=${prNumber}`,
    ];

    if (after) {
      args.push("-F", `after=${after}`);
    }

    const data = await runGhJson(args, {
      cwd,
      useRepoFlag: false,
    });

    pullRequest = data?.data?.repository?.pullRequest ?? null;
    if (!pullRequest) {
      throw new Error(`Pull request #${prNumber} was not found in ${repo}.`);
    }

    const connection = pullRequest.reviewThreads;
    for (const thread of connection.nodes ?? []) {
      threads.push({
        id: thread.id,
        isResolved: thread.isResolved,
        isOutdated: thread.isOutdated,
        isCollapsed: thread.isCollapsed,
        path: thread.path,
        line: thread.line,
        originalLine: thread.originalLine,
        startLine: thread.startLine,
        originalStartLine: thread.originalStartLine,
        diffSide: thread.diffSide,
        comments: (thread.comments?.nodes ?? []).map((comment) => ({
          id: comment.id,
          databaseId: comment.databaseId,
          body: comment.body,
          createdAt: comment.createdAt,
          url: comment.url,
          author: comment.author?.login ?? null,
        })),
      });
    }

    if (!connection?.pageInfo?.hasNextPage) {
      break;
    }

    after = connection.pageInfo.endCursor;
  }

  return {
    pullRequest: {
      number: pullRequest.number,
      title: pullRequest.title,
      url: pullRequest.url,
    },
    threads,
  };
}

async function getReviewCommentContext(repo, commentId, cwd) {
  const data = await runGhJson(["api", `repos/${repo}/pulls/comments/${commentId}`], {
    cwd,
    useRepoFlag: false,
  });

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    pullRequestNumber: data.pull_request_url ? Number(data.pull_request_url.split("/").pop()) : null,
    path: data.path ?? null,
    url: data.html_url ?? null,
    inReplyToId: data.in_reply_to_id ?? null,
  };
}

async function mutateReviewThread(threadId, resolve) {
  const mutationName = resolve ? "resolveReviewThread" : "unresolveReviewThread";
  const query = `
    mutation($threadId: ID!) {
      ${mutationName}(input: { threadId: $threadId }) {
        thread {
          id
          isResolved
          isOutdated
          path
          line
        }
      }
    }
  `;

  const data = await runGhJson(
    ["api", "graphql", "-f", `query=${query}`, "-F", `threadId=${threadId}`],
    { useRepoFlag: false },
  );

  return data?.data?.[mutationName]?.thread ?? null;
}

async function createPrComment(repo, prNumber, body, cwd) {
  const data = await runGhJson(
    ["api", `repos/${repo}/issues/${prNumber}/comments`, "-f", `body=${body}`],
    {
      cwd,
      useRepoFlag: false,
    },
  );

  return {
    id: data.id,
    url: data.html_url,
    body: data.body,
    createdAt: data.created_at,
    author: data.user?.login ?? null,
  };
}

async function createReviewReply(repo, commentId, body, cwd) {
  const data = await runGhJson(
    ["api", `repos/${repo}/pulls/comments/${commentId}/replies`, "-f", `body=${body}`],
    {
      cwd,
      useRepoFlag: false,
    },
  );

  return {
    id: data.id,
    url: data.html_url,
    body: data.body,
    createdAt: data.created_at,
    author: data.user?.login ?? null,
    inReplyToId: data.in_reply_to_id,
  };
}

async function findThreadByReviewCommentId(repo, prNumber, commentId, cwd) {
  const threadData = await fetchReviewThreads(repo, prNumber, cwd);
  for (const thread of threadData.threads) {
    for (const comment of thread.comments) {
      if (Number(comment.databaseId) === Number(commentId)) {
        return {
          pullRequest: threadData.pullRequest,
          thread,
          comment,
        };
      }
    }
  }

  return null;
}

async function requestReviewers(repo, prNumber, reviewers, cwd) {
  const reviewerList = normalizeReviewerList(reviewers);
  await runGh(
    ["pr", "edit", String(prNumber), "--add-reviewer", reviewerList.join(",")],
    { cwd, repo },
  );

  return getPrView(repo, cwd, prNumber, [
    "number",
    "title",
    "url",
    "reviewDecision",
    "reviewRequests",
    "updatedAt",
  ]);
}

async function getCurrentBranch(cwd) {
  const { stdout } = await runGit(["-C", cwd, "branch", "--show-current"], { cwd });
  return stdout || null;
}

async function getUpstreamBranch(cwd) {
  const result = await tryGit(
    ["-C", cwd, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    { cwd },
  );
  return result?.stdout || null;
}

function parseUpstream(upstream) {
  if (!upstream || !upstream.includes("/")) {
    return null;
  }

  const [remote, ...branchParts] = upstream.split("/");
  return {
    remote,
    branch: branchParts.join("/"),
  };
}

async function pushBranch(context, repo, session, options = {}) {
  if (!options.dryRun && (!session || session.pushesRemaining <= 0)) {
    throw new Error(
      "No push budget is available for this repo. Configure one with gh_repo_session first.",
    );
  }

  const vcs = await detectVcs(context);
  const currentRepo = await detectCurrentRepo(context);
  if (!currentRepo) {
    throw new Error("Could not determine the current checkout repository for push.");
  }

  if (currentRepo !== repo) {
    throw new Error(
      `Push only supports the current checkout repo (${currentRepo}), not ${repo}.`,
    );
  }

  if (vcs.kind === "jj") {
    const remotes = await getJjRemotes(vcs.root);
    const remote = pickRemote(remotes, options.remote)?.name ?? options.remote ?? "origin";
    const args = ["git", "push", "--remote", remote];
    const bookmarks = options.branch ? [options.branch] : await getCurrentJjBookmarks(vcs.root);
    const warnings = [];

    if (bookmarks.length > 0) {
      for (const bookmark of bookmarks) {
        args.push("--bookmark", bookmark);
      }
    } else {
      warnings.push("No local bookmark points at @, so jj will use its default push selection.");
    }

    if (options.dryRun) {
      args.push("--dry-run");
    }

    if (options.setUpstream) {
      warnings.push("`set_upstream` is ignored for jj pushes.");
    }

    const result = await runJj(args, { cwd: vcs.root });

    return {
      vcs: "jj",
      branch: options.branch ?? null,
      bookmarks,
      remote,
      dryRun: Boolean(options.dryRun),
      stdout: result.stdout,
      stderr: result.stderr,
      warnings,
    };
  }

  const upstream = parseUpstream(await getUpstreamBranch(vcs.root));
  const branch = options.branch || (await getCurrentBranch(vcs.root));
  const remote = options.remote || upstream?.remote || "origin";
  const targetBranch = branch || upstream?.branch;

  if (!targetBranch) {
    throw new Error("Could not determine the branch to push.");
  }

  const args = ["-C", vcs.root, "push"];

  if (options.dryRun) {
    args.push("--dry-run");
  }

  if (options.setUpstream || !upstream || options.remote || options.branch) {
    if (options.setUpstream) {
      args.push("--set-upstream");
    }
    args.push(remote, targetBranch);
  }

  const result = await runGit(args, { cwd: vcs.root });

  return {
    vcs: "git",
    branch: targetBranch,
    remote,
    dryRun: Boolean(options.dryRun),
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function buildWhitelistList(state) {
  return Object.entries(state.whitelist ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([repo, info]) => ({
      repo,
      addedAt: info?.addedAt ?? null,
    }));
}

async function getWorkingCopyStatus(vcs) {
  if (vcs.kind === "jj") {
    const { stdout } = await runJj(["status"], { cwd: vcs.root });
    return {
      vcs: "jj",
      dirty: !stdout.includes("The working copy is clean"),
      raw: stdout,
    };
  }

  if (vcs.kind === "git") {
    const { stdout } = await runGit(["-C", vcs.root, "status", "--short", "--branch"], {
      cwd: vcs.root,
    });
    const lines = stdout.split("\n").filter(Boolean);
    const changeLines = lines.filter((line) => !line.startsWith("## "));
    return {
      vcs: "git",
      dirty: changeLines.length > 0,
      raw: stdout,
    };
  }

  return {
    vcs: vcs.kind,
    dirty: false,
    raw: "",
  };
}

async function getCurrentRefContext(access) {
  if (access.vcs.kind === "jj") {
    const bookmarks = await getCurrentJjBookmarks(access.vcs.root);
    return {
      vcs: "jj",
      bookmarks,
      primaryRef: bookmarks[0] ?? null,
    };
  }

  if (access.vcs.kind === "git") {
    const branch = await getCurrentBranch(access.vcs.root);
    return {
      vcs: "git",
      branch,
      primaryRef: branch,
    };
  }

  return {
    vcs: access.vcs.kind,
    primaryRef: null,
  };
}

// ---------------------------------------------------------------------------
// Review-loop helpers
// ---------------------------------------------------------------------------

async function createPullRequest(repo, cwd, options = {}) {
  const args = ["pr", "create"];

  if (options.title) {
    args.push("--title", options.title);
  }

  if (options.body) {
    args.push("--body", options.body);
  } else if (options.body === "") {
    args.push("--body", "");
  }

  if (options.draft) {
    args.push("--draft");
  }

  if (options.base) {
    args.push("--base", options.base);
  }

  if (options.head) {
    args.push("--head", options.head);
  }

  if (options.fill) {
    args.push("--fill");
  }

  const { stdout, stderr } = await runGh(args, { cwd, repo });

  // gh pr create prints the URL on stdout
  const prUrl = stdout.trim();
  const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
  const prNumber = prNumberMatch ? Number(prNumberMatch[1]) : null;

  return {
    url: prUrl,
    number: prNumber,
    stdout,
    stderr,
  };
}

async function ensurePullRequestForCurrentRef(access, context, options = {}) {
  // First try to find an existing PR
  const existing = await getCurrentPullRequestForVcs(access, context);
  if (existing?.number) {
    return {
      pullRequest: existing,
      created: false,
    };
  }

  // No existing PR — we need to create one
  const cwd = access.vcs.root || context.worktree;

  // For jj, ensure bookmarks are pushed first
  if (access.vcs.kind === "jj") {
    const bookmarks = await getCurrentJjBookmarks(access.vcs.root);
    if (bookmarks.length === 0) {
      throw new Error(
        "No jj bookmark points at @. Create a bookmark before creating a PR (e.g., jj bookmark create <name>).",
      );
    }
  }

  const createOptions = {
    fill: !options.title,
    ...options,
  };

  const result = await createPullRequest(access.repo, cwd, createOptions);

  if (!result.number) {
    throw new Error(`PR was created but could not parse the number from: ${result.url}`);
  }

  // Fetch the full PR data
  const pullRequest = await getPrView(access.repo, cwd, result.number);

  return {
    pullRequest,
    created: true,
    url: result.url,
  };
}

async function listPossibleReviewers(repo, cwd, limit = 30) {
  const { owner, name } = splitRepo(repo);
  const query = `
    query($owner: String!, $name: String!, $first: Int!) {
      repository(owner: $owner, name: $name) {
        mentionableUsers(first: $first) {
          nodes {
            login
            name
          }
        }
      }
    }
  `;

  const data = await runGhJson(
    [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `first=${Math.min(limit, 100)}`,
    ],
    { cwd, useRepoFlag: false },
  );

  const users = data?.data?.repository?.mentionableUsers?.nodes ?? [];
  return users.map((user) => ({
    login: user.login,
    name: user.name ?? null,
  }));
}

async function fetchPrComments(repo, prNumber, cwd) {
  const items = await runGhJson(
    ["api", `repos/${repo}/issues/${prNumber}/comments`, "--paginate"],
    { cwd, useRepoFlag: false },
  );

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.created_at,
    author: { login: comment.user?.login ?? null },
  }));
}

async function collectWorkflowSnapshot(access, context, prNumber, reviewerFilter) {
  const cwd = access.vcs.root || context.worktree;

  const pullRequest = await getPrView(access.repo, cwd, prNumber, [
    "number",
    "title",
    "url",
    "reviewDecision",
    "reviewRequests",
    "latestReviews",
    "reviews",
    "statusCheckRollup",
    "mergeStateStatus",
    "updatedAt",
    "baseRefName",
    "headRefName",
  ]);
  pullRequest.latestReviews = filterReviewsByReviewer(pullRequest.latestReviews, reviewerFilter);
  pullRequest.reviews = filterReviewsByReviewer(pullRequest.reviews, reviewerFilter);

  const checks = getChecksSummary(pullRequest);

  const threadData = await fetchReviewThreads(access.repo, prNumber, cwd);
  const reviewerUpdates = getReviewerUpdateSummary({
    session: access.session,
    reviewerFilter,
    pullRequest,
    threads: threadData.threads,
  });
  await syncReviewerUpdatesAndPersist(access, reviewerUpdates);

  const unresolvedThreads = filterThreadsByReviewer(
    threadData.threads.filter((thread) => !thread.isResolved),
    reviewerFilter,
  );

  const workingCopy = await getWorkingCopyStatus(access.vcs);
  const refContext = await getCurrentRefContext(access);
  const publishStatus = getPublishStatus(workingCopy, refContext);

  return {
    pullRequest,
    checks,
    threadData,
    reviewerUpdates,
    unresolvedThreads,
    workingCopy,
    refContext,
    publishStatus,
  };
}

const POLL_INTERVAL_MS = 30_000;
const POLL_MAX_DURATION_MS = 60 * 60 * 1000; // 1 hour max

async function pollForReviewUpdates(access, context, prNumber, options = {}) {
  const {
    reviewerFilter,
    intervalMs = POLL_INTERVAL_MS,
    maxDurationMs = POLL_MAX_DURATION_MS,
    selectedReviewers,
    lastPublishedChangeAt,
  } = options;

  const startedAt = Date.now();

  while (true) {
    // Check abort signal
    if (context.abort?.aborted) {
      return { aborted: true, reason: "cancelled" };
    }

    // Check max duration
    if (Date.now() - startedAt >= maxDurationMs) {
      return { aborted: true, reason: "timeout" };
    }

    // Collect fresh snapshot
    const snapshot = await collectWorkflowSnapshot(access, context, prNumber, reviewerFilter);

    // Check if there's new review activity
    if (hasNewReviewActivity(snapshot.reviewerUpdates)) {
      return {
        aborted: false,
        reason: "new_activity",
        snapshot,
      };
    }

    // Check if all reviewers are satisfied (someone approved between polls)
    if (selectedReviewers && selectedReviewers.length > 0) {
      const prComments = await fetchPrComments(
        access.repo,
        prNumber,
        access.vcs.root || context.worktree,
      );
      const satisfaction = evaluateReviewerSatisfaction({
        pullRequest: snapshot.pullRequest,
        prComments,
        threads: snapshot.threadData.threads,
        selectedReviewers,
        lastPublishedChangeAt,
      });

      if (satisfaction.allSatisfied) {
        return {
          aborted: false,
          reason: "all_approved",
          snapshot,
          satisfaction,
        };
      }
    }

    // Wait before next poll, but respect abort
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalMs);

      if (context.abort) {
        const onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        if (context.abort.aborted) {
          clearTimeout(timer);
          resolve();
        } else {
          context.abort.addEventListener("abort", onAbort, { once: true });
        }
      }
    });
  }
}

export const session = tool({
  description:
    "Configure or inspect the GitHub workflow session budget for the current repo, including remaining pushes, review rounds, and default reviewers.",
  args: {
    operation: tool.schema
      .enum(["status", "configure", "clear"])
      .describe("Session operation to run."),
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pushes_remaining: tool.schema
      .number()
      .int()
      .optional()
      .describe("Set the remaining push budget to this exact value."),
    pushes_delta: tool.schema
      .number()
      .int()
      .optional()
      .describe("Increase or decrease the remaining push budget by this amount."),
    review_rounds_remaining: tool.schema
      .number()
      .int()
      .optional()
      .describe("Set the remaining review-request budget to this exact value."),
    review_rounds_delta: tool.schema
      .number()
      .int()
      .optional()
      .describe("Increase or decrease the remaining review-request budget by this amount."),
    stop_when_no_unresolved_threads: tool.schema
      .boolean()
      .optional()
      .describe("Stop the workflow when there are no unresolved review threads left."),
    stop_when_approved: tool.schema
      .boolean()
      .optional()
      .describe("Stop the workflow when the PR review decision becomes APPROVED."),
    stop_when_checks_pass: tool.schema
      .boolean()
      .optional()
      .describe("Stop the workflow when all reported status checks are passing."),
    default_reviewers: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Default reviewers to request later. Defaults to @copilot."),
    notes: tool.schema
      .string()
      .optional()
      .describe("Optional note for this repo session, such as stop conditions."),
  },
  async execute(args, context) {
    const ensureWhitelisted = args.operation === "configure";
    const access = await resolveRepoAccess(context, args.repo, { ensureWhitelisted });

    if (args.operation === "status") {
      return stringify({
        kind: "gh_repo_session",
        operation: "status",
        whitelist: whitelistSnapshot(access.state, access.repo),
        session: sessionSnapshot(access.session, access.repo),
      });
    }

    if (args.operation === "clear") {
      await persistStateMutation(access, async (state) => {
        if (!state.sessions[context.sessionID]) {
          return;
        }

        delete state.sessions[context.sessionID][access.repo];
        if (Object.keys(state.sessions[context.sessionID]).length === 0) {
          delete state.sessions[context.sessionID];
        }
      });

      return stringify({
        kind: "gh_repo_session",
        operation: "clear",
        whitelist: whitelistSnapshot(access.state, access.repo),
        session: sessionSnapshot(null, access.repo),
      });
    }

    if (
      args.pushes_remaining === undefined &&
      args.pushes_delta === undefined &&
      args.review_rounds_remaining === undefined &&
      args.review_rounds_delta === undefined &&
      args.stop_when_no_unresolved_threads === undefined &&
      args.stop_when_approved === undefined &&
      args.stop_when_checks_pass === undefined &&
      args.default_reviewers === undefined &&
      args.notes === undefined
    ) {
      throw new Error("configure requires at least one session value to update.");
    }

    await persistStateMutation(access, async (state) => {
      const sessionData = ensureSession(state, context.sessionID, access.repo);

      if (args.pushes_remaining !== undefined) {
        sessionData.pushesRemaining = Math.max(0, args.pushes_remaining);
      }

      if (args.pushes_delta !== undefined) {
        sessionData.pushesRemaining = Math.max(0, sessionData.pushesRemaining + args.pushes_delta);
      }

      if (args.review_rounds_remaining !== undefined) {
        sessionData.reviewRoundsRemaining = Math.max(0, args.review_rounds_remaining);
      }

      if (args.review_rounds_delta !== undefined) {
        sessionData.reviewRoundsRemaining = Math.max(
          0,
          sessionData.reviewRoundsRemaining + args.review_rounds_delta,
        );
      }

      if (args.stop_when_no_unresolved_threads !== undefined) {
        sessionData.stopWhenNoUnresolvedThreads = args.stop_when_no_unresolved_threads;
      }

      if (args.stop_when_approved !== undefined) {
        sessionData.stopWhenApproved = args.stop_when_approved;
      }

      if (args.stop_when_checks_pass !== undefined) {
        sessionData.stopWhenChecksPass = args.stop_when_checks_pass;
      }

      if (args.default_reviewers !== undefined) {
        sessionData.defaultReviewers = normalizeReviewerList(args.default_reviewers);
      }

      if (args.notes !== undefined) {
        sessionData.notes = args.notes || null;
      }

      sessionData.configured = true;

      touchSession(sessionData);
    });

    return stringify({
      kind: "gh_repo_session",
      operation: "configure",
      whitelist: whitelistSnapshot(access.state, access.repo),
      session: sessionSnapshot(access.session, access.repo),
    });
  },
});

export const whitelist = tool({
  description:
    "Inspect or manage the persistent repository whitelist used by the GitHub workflow tools.",
  args: {
    operation: tool.schema
      .enum(["status", "list", "add", "remove"])
      .describe("Whitelist operation to run."),
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout when possible."),
  },
  async execute(args, context) {
    const state = await loadState();

    if (args.operation === "list") {
      return stringify({
        kind: "gh_repo_whitelist",
        operation: "list",
        repositories: buildWhitelistList(state),
      });
    }

    const currentRepo = await detectCurrentRepo(context);
    const repo = args.repo ? normalizeRepo(args.repo) : currentRepo;

    if (!repo) {
      throw new Error(
        "Could not determine the current GitHub repo. Pass repo explicitly for this whitelist action.",
      );
    }

    if (args.operation === "status") {
      return stringify({
        kind: "gh_repo_whitelist",
        operation: "status",
        currentRepo,
        whitelist: whitelistSnapshot(state, repo),
      });
    }

    if (args.operation === "add") {
      const updated = await updateState(async (latestState) => {
        latestState.whitelist[repo] ??= { addedAt: nowIso() };
      });
      return stringify({
        kind: "gh_repo_whitelist",
        operation: "add",
        whitelist: whitelistSnapshot(updated.state, repo),
      });
    }

    const updated = await updateState(async (latestState) => {
      delete latestState.whitelist[repo];
      if (latestState.sessions[context.sessionID]) {
        delete latestState.sessions[context.sessionID][repo];
        if (Object.keys(latestState.sessions[context.sessionID]).length === 0) {
          delete latestState.sessions[context.sessionID];
        }
      }
    });

    return stringify({
      kind: "gh_repo_whitelist",
      operation: "remove",
      whitelist: whitelistSnapshot(updated.state, repo),
    });
  },
});

export const prs = tool({
  description:
    "List open pull requests, inspect the current branch pull request, or view a specific pull request in a whitelisted repo.",
  args: {
    operation: tool.schema
      .enum(["list_open", "current", "view"])
      .describe("PR operation to run."),
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pr: tool.schema
      .number()
      .int()
      .optional()
      .describe("Pull request number for view. Defaults to the current branch PR when omitted."),
    state: tool.schema
      .enum(["open", "closed", "all"])
      .optional()
      .describe("PR state filter for list_open."),
    limit: tool.schema
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of PRs to return for list_open."),
    include_files: tool.schema
      .boolean()
      .optional()
      .describe("Include changed files when viewing a PR."),
    include_comments: tool.schema
      .boolean()
      .optional()
      .describe("Include issue comments when viewing a PR."),
    include_reviews: tool.schema
      .boolean()
      .optional()
      .describe("Include reviews and review requests when viewing a PR."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo);

    if (args.operation === "list_open") {
      const items = await listPullRequests(
        access.repo,
        access.vcs.root || context.worktree,
        args.state,
        args.limit,
      );
      return stringify({
        kind: "gh_repo_prs",
        operation: "list_open",
        repo: access.repo,
        count: items.length,
        pullRequests: items,
      });
    }

    if (args.operation === "current") {
      const current = await getCurrentPullRequestForVcs(access, context);
      return stringify({
        kind: "gh_repo_prs",
        operation: "current",
        repo: access.repo,
        hasPullRequest: Boolean(current),
        pullRequest: current,
      });
    }

    const fields = [
      "number",
      "title",
      "body",
      "author",
      "state",
      "isDraft",
      "reviewDecision",
      "mergeStateStatus",
      "statusCheckRollup",
      "baseRefName",
      "headRefName",
      "updatedAt",
      "url",
    ];

    if (args.include_comments) {
      fields.push("comments");
    }
    if (args.include_reviews !== false) {
      fields.push("latestReviews", "reviewRequests", "reviews");
    }
    if (args.include_files) {
      fields.push("files");
    }

    const prNumber = args.pr ?? null;
    const pullRequest = await getPrViewForAccess(access, context, prNumber, fields);

    return stringify({
      kind: "gh_repo_prs",
      operation: "view",
      repo: access.repo,
      pullRequest,
    });
  },
});

export const reviews = tool({
  description:
    "Read pull request reviews, list review threads, or resolve and unresolve specific review threads in a whitelisted repo.",
  args: {
    operation: tool.schema
      .enum(["reviews", "threads", "resolve", "unresolve"])
      .describe("Review operation to run."),
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pr: tool.schema
      .number()
      .int()
      .optional()
      .describe("Pull request number. Defaults to the current branch PR for read operations."),
    thread_id: tool.schema
      .string()
      .optional()
      .describe("Review thread node ID for resolve or unresolve."),
    reviewer: tool.schema
      .string()
      .optional()
      .describe("Optional reviewer login filter, such as @copilot or copilot."),
    unresolved_only: tool.schema
      .boolean()
      .optional()
      .describe("When listing threads, keep only unresolved ones. Defaults to true."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo);

    if (args.operation === "resolve" || args.operation === "unresolve") {
      if (!args.thread_id) {
        throw new Error(`${args.operation} requires thread_id.`);
      }

      const thread = await mutateReviewThread(args.thread_id, args.operation === "resolve");
      return stringify({
        kind: "gh_repo_reviews",
        operation: args.operation,
        repo: access.repo,
        thread,
      });
    }

    const prNumber = await requirePrNumberForAccess(access, context, args.pr);

    if (args.operation === "reviews") {
      const view = await getPrView(access.repo, access.vcs.root || context.worktree, prNumber, [
        "number",
        "title",
        "url",
        "reviewDecision",
        "reviewRequests",
        "latestReviews",
        "reviews",
        "updatedAt",
        "statusCheckRollup",
      ]);

      view.latestReviews = filterReviewsByReviewer(view.latestReviews, args.reviewer);
      view.reviews = filterReviewsByReviewer(view.reviews, args.reviewer);

      return stringify({
        kind: "gh_repo_reviews",
        operation: "reviews",
        repo: access.repo,
        pullRequest: view,
      });
    }

    const threadData = await fetchReviewThreads(
      access.repo,
      prNumber,
      access.vcs.root || context.worktree,
    );
    let threads = threadData.threads;

    if (args.unresolved_only !== false) {
      threads = threads.filter((thread) => !thread.isResolved);
    }

    threads = filterThreadsByReviewer(threads, args.reviewer);

    return stringify({
      kind: "gh_repo_reviews",
      operation: "threads",
      repo: access.repo,
      pullRequest: threadData.pullRequest,
      unresolvedOnly: args.unresolved_only !== false,
      count: threads.length,
      threads,
    });
  },
});

export const comment = tool({
  description:
    "Comment on a pull request or reply to a specific review comment in a whitelisted repo.",
  args: {
    operation: tool.schema
      .enum(["comment_pr", "reply_to_review_comment"])
      .describe("Comment operation to run."),
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pr: tool.schema
      .number()
      .int()
      .optional()
      .describe("Pull request number for comment_pr. Defaults to the current branch PR."),
    comment_id: tool.schema
      .number()
      .int()
      .optional()
      .describe("Numeric review comment ID for reply_to_review_comment."),
    body: tool.schema.string().describe("Comment body text."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo);

    if (args.operation === "comment_pr") {
      const prNumber = await requirePrNumberForAccess(access, context, args.pr);
      const created = await createPrComment(
        access.repo,
        prNumber,
        args.body,
        access.vcs.root || context.worktree,
      );
      return stringify({
        kind: "gh_repo_comment",
        operation: "comment_pr",
        repo: access.repo,
        pullRequest: prNumber,
        comment: created,
      });
    }

    if (!args.comment_id) {
      throw new Error("reply_to_review_comment requires comment_id.");
    }

    let commentContext;
    try {
      commentContext = await getReviewCommentContext(
        access.repo,
        args.comment_id,
        access.vcs.root || context.worktree,
      );
    } catch (error) {
      if (isMissingCommentResourceError(error)) {
        throw new Error(
          `Review comment ${args.comment_id} was not found in ${access.repo} or is not accessible.`,
        );
      }

      throw error;
    }

    if (!commentContext) {
      throw new Error(`Review comment ${args.comment_id} was not found in ${access.repo}.`);
    }

    if (args.pr && commentContext.pullRequestNumber && commentContext.pullRequestNumber !== args.pr) {
      throw new Error(
        `Review comment ${args.comment_id} belongs to pull request #${commentContext.pullRequestNumber}, not #${args.pr}.`,
      );
    }

    const created = await createReviewReply(
      access.repo,
      args.comment_id,
      args.body,
      access.vcs.root || context.worktree,
    );
    return stringify({
      kind: "gh_repo_comment",
      operation: "reply_to_review_comment",
      repo: access.repo,
      reply: created,
    });
  },
});

export const request_review = tool({
  description:
    "Request or re-request pull request reviews in a whitelisted repo. Defaults to @copilot when no reviewers are provided and consumes one configured review round.",
  args: {
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pr: tool.schema
      .number()
      .int()
      .optional()
      .describe("Pull request number. Defaults to the current branch PR."),
    reviewers: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Reviewer logins to request. Defaults to the session reviewers, usually @copilot."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo);
    const sessionData = ensureSession(access.state, context.sessionID, access.repo);
    if (sessionData.reviewRoundsRemaining <= 0) {
      throw new Error(
        "No review-round budget is available for this repo. Configure one with gh_repo_session first.",
      );
    }

    const prNumber = await requirePrNumberForAccess(access, context, args.pr);
    const reviewers =
      args.reviewers && args.reviewers.length > 0
        ? args.reviewers
        : sessionData.defaultReviewers ?? cloneDefaultReviewers();

    const pullRequest = await requestReviewers(
      access.repo,
      prNumber,
      reviewers,
      access.vcs.root || context.worktree,
    );

    await persistStateMutation(access, async (state) => {
      const sessionData = ensureSession(state, context.sessionID, access.repo);
      sessionData.reviewRoundsRemaining = Math.max(0, sessionData.reviewRoundsRemaining - 1);
      sessionData.reviewRoundsUsed += 1;
      sessionData.awaitingReviewUpdates = true;
      sessionData.lastReviewRequestedAt = nowIso();
      touchSession(sessionData);
    });

    return stringify({
      kind: "gh_repo_request_review",
      repo: access.repo,
      reviewers: normalizeReviewerList(reviewers),
      pullRequest,
      session: sessionSnapshot(access.session, access.repo),
    });
  },
});

export const push = tool({
  description:
    "Push the current branch to GitHub while consuming the repo session push budget managed by gh_repo_session.",
  args: {
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    remote: tool.schema
      .string()
      .optional()
      .describe("Optional remote name. Defaults to the upstream remote or origin."),
    branch: tool.schema
      .string()
      .optional()
      .describe("Optional branch name. Defaults to the current branch or upstream branch."),
    set_upstream: tool.schema
      .boolean()
      .optional()
      .describe("Set upstream while pushing, useful for the first push of a new branch."),
    dry_run: tool.schema
      .boolean()
      .optional()
      .describe("Run git push --dry-run without consuming the push budget."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo, { requireCurrentRepo: true });
    const sessionData = ensureSession(access.state, context.sessionID, access.repo);
    const result = await pushBranch(context, access.repo, sessionData, {
      remote: args.remote,
      branch: args.branch,
      setUpstream: Boolean(args.set_upstream),
      dryRun: Boolean(args.dry_run),
    });

    if (!args.dry_run) {
      await persistStateMutation(access, async (state) => {
        const sessionData = ensureSession(state, context.sessionID, access.repo);
        sessionData.pushesRemaining = Math.max(0, sessionData.pushesRemaining - 1);
        sessionData.pushesUsed += 1;
        touchSession(sessionData);
      });
    }

    return stringify({
      kind: "gh_repo_push",
      repo: access.repo,
      result,
      session: sessionSnapshot(access.session, access.repo),
    });
  },
});

export const summary = tool({
  description:
    "Summarize the current or specified pull request, including review state, unresolved threads, status checks, and remaining push budget.",
  args: {
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pr: tool.schema
      .number()
      .int()
      .optional()
      .describe("Pull request number. Defaults to the current branch PR."),
    reviewer: tool.schema
      .string()
      .optional()
      .describe("Optional reviewer login filter, such as @copilot or copilot."),
    unresolved_only: tool.schema
      .boolean()
      .optional()
      .describe("When true, only include unresolved review threads. Defaults to true."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo);
    const currentPr = await getCurrentPullRequestForVcs(access, context);
    const prNumber = args.pr ?? currentPr?.number ?? null;

    if (!prNumber) {
      return stringify({
        kind: "gh_repo_summary",
        repo: access.repo,
        whitelist: whitelistSnapshot(access.state, access.repo),
        session: sessionSnapshot(access.session, access.repo),
        hasPullRequest: false,
      });
    }

    const pullRequest = await getPrView(
      access.repo,
      access.vcs.root || context.worktree,
      prNumber,
      [
        "number",
        "title",
        "url",
        "reviewDecision",
        "reviewRequests",
        "latestReviews",
        "reviews",
        "statusCheckRollup",
        "mergeStateStatus",
        "updatedAt",
        "baseRefName",
        "headRefName",
      ],
    );

    pullRequest.latestReviews = filterReviewsByReviewer(pullRequest.latestReviews, args.reviewer);
    pullRequest.reviews = filterReviewsByReviewer(pullRequest.reviews, args.reviewer);

    const threadData = await fetchReviewThreads(
      access.repo,
      prNumber,
      access.vcs.root || context.worktree,
    );
    let threads = threadData.threads;
    if (args.unresolved_only !== false) {
      threads = threads.filter((thread) => !thread.isResolved);
    }
    threads = filterThreadsByReviewer(threads, args.reviewer);

    return stringify({
      kind: "gh_repo_summary",
      repo: access.repo,
      whitelist: whitelistSnapshot(access.state, access.repo),
      session: sessionSnapshot(access.session, access.repo),
      pullRequest,
      unresolvedOnly: args.unresolved_only !== false,
      reviewerFilter: args.reviewer ?? null,
      unresolvedThreadCount: threads.length,
      threads,
    });
  },
});

export const workflow = tool({
  description:
    "Plan and optionally advance the GitHub review workflow for the current PR using the repo session budget and stop conditions.",
  args: {
    operation: tool.schema
      .enum(["status", "advance", "run"])
      .describe("Return workflow state only, advance one step, or run the full review-loop (poll until reviews arrive, then return)."),
    repo: tool.schema
      .string()
      .optional()
      .describe("Optional repo in owner/name format. Defaults to the current checkout."),
    pr: tool.schema
      .number()
      .int()
      .optional()
      .describe("Pull request number. Defaults to the current branch or jj bookmark PR."),
    reviewer: tool.schema
      .string()
      .optional()
      .describe("Optional reviewer login filter, such as @copilot or copilot."),
    action: tool.schema
      .enum(["auto", "request_review", "push", "reply_and_resolve"])
      .optional()
      .describe("For advance, pick the next step automatically or force a specific step."),
    reply_body: tool.schema
      .string()
      .optional()
      .describe("Reply text to use with reply_and_resolve."),
    review_comment_id: tool.schema
      .number()
      .int()
      .optional()
      .describe("Numeric review comment ID to reply to when using reply_and_resolve."),
    thread_id: tool.schema
      .string()
      .optional()
      .describe("Review thread ID to resolve when using reply_and_resolve."),
  },
  async execute(args, context) {
    const access = await resolveRepoAccess(context, args.repo, { requireCurrentRepo: true });
    const sessionData = ensureSession(access.state, context.sessionID, access.repo);

    if (!sessionData.configured) {
      try {
        await context.ask({
          permission: "gh_repo_workflow_budget",
          patterns: [access.repo],
          always: [],
          metadata: {
            repo: access.repo,
            action: "configure_session_budget",
            message:
              "Before starting the GitHub workflow, configure a push budget with gh_repo_session. You can also set review rounds and stop conditions.",
            suggested: {
              operation: "configure",
              pushes_remaining: 1,
              review_rounds_remaining: 1,
              stop_when_approved: true,
              stop_when_checks_pass: true,
            },
          },
        });
      } catch {}

      throw new Error(
        "Workflow session is not configured. First call gh_repo_session with operation 'configure' and set at least pushes_remaining.",
      );
    }

    // -----------------------------------------------------------------------
    // run: full review-loop entry point (poll until reviews, return snapshot)
    // -----------------------------------------------------------------------
    if (args.operation === "run") {
      // Phase 1: Ensure a PR exists
      const prResult = await ensurePullRequestForCurrentRef(access, context, {
        title: undefined,
        fill: true,
      });
      const prNumber = prResult.pullRequest.number;
      const prUrl = prResult.pullRequest.url ?? prResult.url ?? null;

      // Persist review-loop state
      await persistStateMutation(access, async (state) => {
        const sd = ensureSession(state, context.sessionID, access.repo);
        sd.reviewLoopActive = true;
        sd.reviewLoopPhase = REVIEW_LOOP_PHASES.STARTING;
        sd.prNumber = prNumber;
        sd.prUrl = prUrl;
        touchSession(sd);
      });

      // Phase 2: Collect initial snapshot
      const snapshot = await collectWorkflowSnapshot(access, context, prNumber, args.reviewer);

      // Determine current reviewers
      const currentReviewers = normalizeRequestedReviewers(snapshot.pullRequest);

      // Fetch PR issue comments for satisfaction check
      const prComments = await fetchPrComments(
        access.repo,
        prNumber,
        access.vcs.root || context.worktree,
      );

      const selectedReviewers = access.session?.selectedReviewers ?? currentReviewers;
      const lastPublishedChangeAt = access.session?.lastPublishedChangeAt ?? null;

      const satisfaction = evaluateReviewerSatisfaction({
        pullRequest: snapshot.pullRequest,
        prComments,
        threads: snapshot.threadData.threads,
        selectedReviewers,
        lastPublishedChangeAt,
      });

      const publishStatus = snapshot.publishStatus;

      const phase = getReviewLoopPhase({
        session: access.session,
        hasPullRequest: true,
        currentReviewers: selectedReviewers,
        reviewerUpdates: snapshot.reviewerUpdates,
        unresolvedThreadCount: snapshot.unresolvedThreads.length,
        satisfaction,
        publishStatus,
      });

      // Persist phase
      await persistStateMutation(access, async (state) => {
        const sd = ensureSession(state, context.sessionID, access.repo);
        sd.reviewLoopPhase = phase;
        touchSession(sd);
      });

      // If completed, return immediately
      if (phase === REVIEW_LOOP_PHASES.COMPLETED) {
        await persistStateMutation(access, async (state) => {
          const sd = ensureSession(state, context.sessionID, access.repo);
          sd.reviewLoopActive = false;
          touchSession(sd);
        });

        return stringify({
          kind: "gh_repo_workflow",
          operation: "run",
          repo: access.repo,
          session: sessionSnapshot(access.session, access.repo),
          phase,
          prCreated: prResult.created,
          pullRequest: snapshot.pullRequest,
          checks: snapshot.checks,
          satisfaction,
          publishStatus,
          unresolvedThreadCount: snapshot.unresolvedThreads.length,
          message: "All selected reviewers are satisfied. Review loop complete.",
        });
      }

      // If needs reviewer, needs PR, or has feedback already, return to agent
      if (
        phase === REVIEW_LOOP_PHASES.NEEDS_REVIEWER ||
        phase === REVIEW_LOOP_PHASES.NEEDS_PR ||
        phase === REVIEW_LOOP_PHASES.REVIEW_FEEDBACK_RECEIVED ||
        phase === REVIEW_LOOP_PHASES.NEEDS_PUSH_REFILL
      ) {
        return stringify({
          kind: "gh_repo_workflow",
          operation: "run",
          repo: access.repo,
          session: sessionSnapshot(access.session, access.repo),
          phase,
          prCreated: prResult.created,
          pullRequest: snapshot.pullRequest,
          checks: snapshot.checks,
          workingCopy: snapshot.workingCopy,
          refContext: snapshot.refContext,
          publishStatus,
          reviewerUpdates: snapshot.reviewerUpdates,
          unresolvedThreadCount: snapshot.unresolvedThreads.length,
          unresolvedThreads: snapshot.unresolvedThreads,
          satisfaction,
          possibleReviewers: null,
          message: `Review loop phase: ${phase}. Agent should handle this phase.`,
        });
      }

      // Phase: WAITING_FOR_REVIEW — enter polling loop
      const pollResult = await pollForReviewUpdates(access, context, prNumber, {
        reviewerFilter: args.reviewer,
        selectedReviewers,
        lastPublishedChangeAt,
      });

      if (pollResult.aborted) {
        await persistStateMutation(access, async (state) => {
          const sd = ensureSession(state, context.sessionID, access.repo);
          sd.reviewLoopActive = false;
          sd.reviewLoopPhase = null;
          touchSession(sd);
        });

        return stringify({
          kind: "gh_repo_workflow",
          operation: "run",
          repo: access.repo,
          session: sessionSnapshot(access.session, access.repo),
          phase: REVIEW_LOOP_PHASES.WAITING_FOR_REVIEW,
          pollAborted: true,
          pollAbortReason: pollResult.reason,
          message: `Polling stopped: ${pollResult.reason}.`,
        });
      }

      // Poll returned with new activity or all-approved
      const finalSnapshot = pollResult.snapshot;
      const finalPhase = pollResult.reason === "all_approved"
        ? REVIEW_LOOP_PHASES.COMPLETED
        : REVIEW_LOOP_PHASES.REVIEW_FEEDBACK_RECEIVED;

      await persistStateMutation(access, async (state) => {
        const sd = ensureSession(state, context.sessionID, access.repo);
        sd.reviewLoopPhase = finalPhase;
        if (finalPhase === REVIEW_LOOP_PHASES.COMPLETED) {
          sd.reviewLoopActive = false;
        }
        touchSession(sd);
      });

      return stringify({
        kind: "gh_repo_workflow",
        operation: "run",
        repo: access.repo,
        session: sessionSnapshot(access.session, access.repo),
        phase: finalPhase,
        prCreated: prResult.created,
        pullRequest: finalSnapshot.pullRequest,
        checks: finalSnapshot.checks,
        workingCopy: finalSnapshot.workingCopy,
        refContext: finalSnapshot.refContext,
        publishStatus: finalSnapshot.publishStatus,
        reviewerUpdates: finalSnapshot.reviewerUpdates,
        unresolvedThreadCount: finalSnapshot.unresolvedThreads.length,
        unresolvedThreads: finalSnapshot.unresolvedThreads,
        satisfaction: pollResult.satisfaction ?? null,
        message:
          finalPhase === REVIEW_LOOP_PHASES.COMPLETED
            ? "All selected reviewers are satisfied. Review loop complete."
            : "New review activity detected. Agent should evaluate feedback and act.",
      });
    }

    const currentPr = await getCurrentPullRequestForVcs(access, context);
    const prNumber = args.pr ?? currentPr?.number ?? null;

    if (!prNumber) {
      return stringify({
        kind: "gh_repo_workflow",
        repo: access.repo,
        session: sessionSnapshot(access.session, access.repo),
        hasPullRequest: false,
        nextActions: ["wait"],
        stopReasons: ["no_pull_request"],
      });
    }

    const pullRequest = await getPrView(
      access.repo,
      access.vcs.root || context.worktree,
      prNumber,
      [
        "number",
        "title",
        "url",
        "reviewDecision",
        "reviewRequests",
        "latestReviews",
        "reviews",
        "statusCheckRollup",
        "mergeStateStatus",
        "updatedAt",
        "baseRefName",
        "headRefName",
      ],
    );
    pullRequest.latestReviews = filterReviewsByReviewer(pullRequest.latestReviews, args.reviewer);
    pullRequest.reviews = filterReviewsByReviewer(pullRequest.reviews, args.reviewer);
    const checks = getChecksSummary(pullRequest);

    const threadData = await fetchReviewThreads(
      access.repo,
      prNumber,
      access.vcs.root || context.worktree,
    );
    const reviewerUpdates = getReviewerUpdateSummary({
      session: access.session,
      reviewerFilter: args.reviewer,
      pullRequest,
      threads: threadData.threads,
    });
    await syncReviewerUpdatesAndPersist(access, reviewerUpdates);
    const unresolvedThreads = filterThreadsByReviewer(
      threadData.threads.filter((thread) => !thread.isResolved),
      args.reviewer,
    );
    const workingCopy = await getWorkingCopyStatus(access.vcs);
    const refContext = await getCurrentRefContext(access);

    const baseResult = {
      kind: "gh_repo_workflow",
      repo: access.repo,
      session: sessionSnapshot(access.session, access.repo),
      workingCopy,
      refContext,
      pullRequest,
      checks,
      reviewerUpdates,
      unresolvedThreadCount: unresolvedThreads.length,
      unresolvedThreads,
    };

    let nextActions = getWorkflowNextActions({
      session: access.session,
      unresolvedThreadCount: unresolvedThreads.length,
      pullRequest,
      workingCopy,
      reviewerUpdates,
    });

    let stopReasons = getWorkflowStopReasons({
      session: access.session,
      unresolvedThreadCount: unresolvedThreads.length,
      pullRequest,
      workingCopy,
      checksPass: checks.passing,
      reviewerUpdates,
      afterRequestReview: false,
    });

    if (args.operation === "status") {
      return stringify({
        ...baseResult,
        nextActions,
        stopReasons,
      });
    }

    const requestedAction = args.action ?? "auto";
    let performedAction = null;
    let actionResult = null;
    const chosenAction = chooseWorkflowAction(nextActions, requestedAction);
    const blockingStopReasons = getBlockingWorkflowStopReasons(chosenAction, stopReasons);

    if (!chosenAction || blockingStopReasons.length > 0) {
      return stringify({
        ...baseResult,
        nextActions,
        stopReasons,
        performedAction,
        actionResult,
      });
    }

    if (chosenAction === "reply_and_resolve") {
      if (!args.reply_body) {
        throw new Error("reply_and_resolve requires reply_body.");
      }

      let targetThreadId = args.thread_id ?? null;
      let reply = null;

      if (args.review_comment_id) {
        const commentContext = await getReviewCommentContext(
          access.repo,
          args.review_comment_id,
          access.vcs.root || context.worktree,
        );

        if (!commentContext) {
          throw new Error(`Review comment ${args.review_comment_id} was not found in ${access.repo}.`);
        }

        if (commentContext.pullRequestNumber && commentContext.pullRequestNumber !== prNumber) {
          throw new Error(
            `Review comment ${args.review_comment_id} belongs to pull request #${commentContext.pullRequestNumber}, not #${prNumber}.`,
          );
        }

        reply = await createReviewReply(
          access.repo,
          args.review_comment_id,
          args.reply_body,
          access.vcs.root || context.worktree,
        );

        if (!targetThreadId) {
          const located = await findThreadByReviewCommentId(
            access.repo,
            prNumber,
            args.review_comment_id,
            access.vcs.root || context.worktree,
          );
          targetThreadId = located?.thread?.id ?? null;
        }
      }

      if (!targetThreadId) {
        throw new Error("reply_and_resolve requires thread_id or review_comment_id.");
      }

      const resolvedThread = await mutateReviewThread(targetThreadId, true);
      actionResult = {
        reply,
        resolvedThread,
      };
      performedAction = "reply_and_resolve";
    } else if (chosenAction === "push_changes") {
      actionResult = await pushBranch(context, access.repo, sessionData, {
        dryRun: false,
      });
      await persistStateMutation(access, async (state) => {
        const sessionData = ensureSession(state, context.sessionID, access.repo);
        sessionData.pushesRemaining = Math.max(0, sessionData.pushesRemaining - 1);
        sessionData.pushesUsed += 1;
        touchSession(sessionData);
      });
      performedAction = "push_changes";
    } else if (chosenAction === "request_review") {
      if (sessionData.reviewRoundsRemaining <= 0) {
        stopReasons = [...new Set([...stopReasons, "review_round_budget_exhausted"])];
      } else {
        const reviewers = sessionData.defaultReviewers ?? cloneDefaultReviewers();
        actionResult = await requestReviewers(
          access.repo,
          prNumber,
          reviewers,
          access.vcs.root || context.worktree,
        );
        await persistStateMutation(access, async (state) => {
          const sessionData = ensureSession(state, context.sessionID, access.repo);
          sessionData.reviewRoundsRemaining = Math.max(0, sessionData.reviewRoundsRemaining - 1);
          sessionData.reviewRoundsUsed += 1;
          sessionData.awaitingReviewUpdates = true;
          sessionData.lastReviewRequestedAt = nowIso();
          touchSession(sessionData);
        });
        performedAction = "request_review";
      }
    }

    const refreshedWorkingCopy = await getWorkingCopyStatus(access.vcs);
    const refreshedPullRequest = await getPrView(
      access.repo,
      access.vcs.root || context.worktree,
      prNumber,
      [
        "number",
        "title",
        "url",
        "reviewDecision",
        "reviewRequests",
        "latestReviews",
        "reviews",
        "statusCheckRollup",
        "mergeStateStatus",
        "updatedAt",
        "baseRefName",
        "headRefName",
      ],
    );
    refreshedPullRequest.latestReviews = filterReviewsByReviewer(
      refreshedPullRequest.latestReviews,
      args.reviewer,
    );
    refreshedPullRequest.reviews = filterReviewsByReviewer(refreshedPullRequest.reviews, args.reviewer);
    const refreshedChecks = getChecksSummary(refreshedPullRequest);

    const refreshedThreads = await fetchReviewThreads(
      access.repo,
      prNumber,
      access.vcs.root || context.worktree,
    );
    const refreshedReviewerUpdates = getReviewerUpdateSummary({
      session: access.session,
      reviewerFilter: args.reviewer,
      pullRequest: refreshedPullRequest,
      threads: refreshedThreads.threads,
    });
    await syncReviewerUpdatesAndPersist(access, refreshedReviewerUpdates);
    const refreshedUnresolvedThreads = filterThreadsByReviewer(
      refreshedThreads.threads.filter((thread) => !thread.isResolved),
      args.reviewer,
    );

    nextActions = getWorkflowNextActions({
      session: access.session,
      unresolvedThreadCount: refreshedUnresolvedThreads.length,
      pullRequest: refreshedPullRequest,
      workingCopy: refreshedWorkingCopy,
      reviewerUpdates: refreshedReviewerUpdates,
    });

    stopReasons = getWorkflowStopReasons({
      session: access.session,
      unresolvedThreadCount: refreshedUnresolvedThreads.length,
      pullRequest: refreshedPullRequest,
      workingCopy: refreshedWorkingCopy,
      checksPass: refreshedChecks.passing,
      reviewerUpdates: refreshedReviewerUpdates,
      afterRequestReview: performedAction === "request_review",
    });

    return stringify({
      kind: "gh_repo_workflow",
      repo: access.repo,
      session: sessionSnapshot(access.session, access.repo),
      workingCopy: refreshedWorkingCopy,
      refContext,
      pullRequest: refreshedPullRequest,
      checks: refreshedChecks,
      reviewerUpdates: refreshedReviewerUpdates,
      unresolvedThreadCount: refreshedUnresolvedThreads.length,
      unresolvedThreads: refreshedUnresolvedThreads,
      nextActions,
      stopReasons,
      performedAction,
      actionResult,
    });
  },
});
