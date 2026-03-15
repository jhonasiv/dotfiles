export const DEFAULT_REVIEWERS = ["@copilot"];

const PASSING_CHECK_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const PASSING_STATUS_STATES = new Set(["SUCCESS"]);

function getRelevantReviewerLogins(session, reviewerFilter) {
  if (reviewerFilter) {
    return [String(reviewerFilter).replace(/^@/, "").toLowerCase()];
  }

  const reviewers = Array.isArray(session?.defaultReviewers) ? session.defaultReviewers : DEFAULT_REVIEWERS;
  return reviewers.map((reviewer) => String(reviewer).replace(/^@/, "").toLowerCase());
}

function matchesAnyRelevantReviewer(login, reviewers) {
  const normalizedLogin = String(login ?? "").toLowerCase();
  return reviewers.some((reviewer) => normalizedLogin.includes(reviewer));
}

export function getWorkflowStopReasons({
  session,
  unresolvedThreadCount,
  pullRequest,
  workingCopy,
  publishStatus,
  checksPass,
  reviewerUpdates,
  afterRequestReview,
}) {
  const reasons = [];
  const approved = pullRequest?.reviewDecision === "APPROVED";
  const stopOnApproved = session?.stopWhenApproved ?? false;
  const stopOnChecksPass = session?.stopWhenChecksPass ?? false;

  if ((session?.stopWhenNoUnresolvedThreads ?? false) && unresolvedThreadCount === 0) {
    reasons.push("no_unresolved_threads");
  }

  if (stopOnApproved && stopOnChecksPass) {
    if (approved && checksPass) {
      reasons.push("approved_and_checks_passing");
    }
  } else {
    if (stopOnApproved && approved) {
      reasons.push("approved");
    }

    if (stopOnChecksPass && checksPass) {
      reasons.push("checks_passing");
    }
  }

  if ((session?.pushesRemaining ?? 0) <= 0) {
    reasons.push("push_budget_exhausted");
  }

  if ((session?.reviewRoundsRemaining ?? 0) <= 0) {
    reasons.push("review_round_budget_exhausted");
  }

  if (publishStatus?.ambiguous) {
    reasons.push("ambiguous_publish_state");
  }

  if (afterRequestReview) {
    reasons.push("review_requested");
  }

  if (
    !workingCopy.dirty &&
    unresolvedThreadCount > 0 &&
    !publishStatus?.hasCommittedUnpublishedChanges
  ) {
    reasons.push("awaiting_code_changes_or_reply");
  }

  if (reviewerUpdates?.awaiting && !reviewerUpdates?.hasNewUpdates) {
    reasons.push("waiting_for_review_updates");
  }

  return [...new Set(reasons)];
}

export function getChecksSummary(pullRequest) {
  const items = Array.isArray(pullRequest?.statusCheckRollup) ? pullRequest.statusCheckRollup : [];
  if (items.length === 0) {
    return {
      total: 0,
      pending: 0,
      failing: 0,
      passing: true,
      details: [],
    };
  }

  const details = items.map((item) => {
    const status = item?.status ?? null;
    const conclusion = item?.conclusion ?? null;
    const isPending = status !== "COMPLETED";
    const isPassing = isPending
      ? false
      : item?.__typename === "CheckRun"
        ? PASSING_CHECK_CONCLUSIONS.has(conclusion ?? "")
        : PASSING_STATUS_STATES.has((item?.state ?? "").toUpperCase());

    return {
      type: item?.__typename ?? null,
      name: item?.name ?? item?.context ?? null,
      workflowName: item?.workflowName ?? null,
      status,
      conclusion,
      state: item?.state ?? null,
      detailsUrl: item?.detailsUrl ?? item?.targetUrl ?? null,
      passing: isPassing,
      pending: isPending,
    };
  });

  const pending = details.filter((item) => item.pending).length;
  const failing = details.filter((item) => !item.pending && !item.passing).length;

  return {
    total: details.length,
    pending,
    failing,
    passing: pending === 0 && failing === 0,
    details,
  };
}

export function getReviewerUpdateSummary({ session, reviewerFilter, pullRequest, threads }) {
  const since = session?.lastReviewRequestedAt ? Date.parse(session.lastReviewRequestedAt) : null;
  const awaiting = session?.awaitingReviewUpdates ?? false;
  const reviewers = getRelevantReviewerLogins(session, reviewerFilter);

  const updates = [];

  for (const review of pullRequest?.reviews ?? []) {
    const submittedAt = review?.submittedAt ? Date.parse(review.submittedAt) : null;
    if (
      submittedAt &&
      (!since || submittedAt > since) &&
      matchesAnyRelevantReviewer(review?.author?.login, reviewers)
    ) {
      updates.push({
        type: "review",
        author: review?.author?.login ?? null,
        submittedAt: review.submittedAt,
        state: review?.state ?? null,
        id: review?.id ?? null,
      });
    }
  }

  for (const thread of threads ?? []) {
    for (const comment of thread.comments ?? []) {
      const createdAt = comment?.createdAt ? Date.parse(comment.createdAt) : null;
      if (
        createdAt &&
        (!since || createdAt > since) &&
        matchesAnyRelevantReviewer(comment?.author, reviewers)
      ) {
        updates.push({
          type: "review_comment",
          author: comment?.author ?? null,
          createdAt: comment.createdAt,
          id: comment?.databaseId ?? null,
          threadId: thread.id,
          path: thread.path,
        });
      }
    }
  }

  return {
    awaiting,
    since: session?.lastReviewRequestedAt ?? null,
    reviewers,
    hasNewUpdates: updates.length > 0,
    updates,
  };
}

export function syncReviewerUpdateState(session, reviewerUpdates) {
  if (!reviewerUpdates?.hasNewUpdates || !session?.awaitingReviewUpdates) {
    return false;
  }

  session.awaitingReviewUpdates = false;
  session.updatedAt = new Date().toISOString();
  reviewerUpdates.awaiting = false;
  return true;
}

const AUTO_WORKFLOW_ACTION_PRIORITY = ["reply_and_resolve", "push_changes", "request_review"];

const ALWAYS_BLOCKING_WORKFLOW_REASONS = new Set([
  "no_unresolved_threads",
  "approved",
  "checks_passing",
  "approved_and_checks_passing",
  "review_requested",
]);

const ACTION_BLOCKING_WORKFLOW_REASONS = {
  reply_and_resolve: new Set(),
  push_changes: new Set(["push_budget_exhausted", "ambiguous_publish_state"]),
  request_review: new Set([
    "review_round_budget_exhausted",
    "waiting_for_review_updates",
    "awaiting_code_changes_or_reply",
    "ambiguous_publish_state",
  ]),
};

export function chooseWorkflowAction(nextActions, requestedAction) {
  if (requestedAction && requestedAction !== "auto") {
    return requestedAction === "push" ? "push_changes" : requestedAction;
  }

  return AUTO_WORKFLOW_ACTION_PRIORITY.find((action) => nextActions.includes(action)) ?? null;
}

export function getBlockingWorkflowStopReasons(chosenAction, stopReasons) {
  if (!chosenAction) {
    return stopReasons;
  }

  const actionReasons = ACTION_BLOCKING_WORKFLOW_REASONS[chosenAction] ?? new Set();
  return stopReasons.filter(
    (reason) => ALWAYS_BLOCKING_WORKFLOW_REASONS.has(reason) || actionReasons.has(reason),
  );
}

export function getWorkflowNextActions({
  session,
  unresolvedThreadCount,
  pullRequest,
  workingCopy,
  reviewerUpdates,
  publishStatus,
}) {
  const actions = [];

  if (unresolvedThreadCount > 0) {
    actions.push("review_threads");
    actions.push("reply_and_resolve");
  }

  const effectiveDirty = publishStatus ? publishStatus.hasUnpushedCommits : workingCopy.dirty;
  const canAutoPublish = publishStatus ? !publishStatus.ambiguous : true;

  if (effectiveDirty && canAutoPublish && (session?.pushesRemaining ?? 0) > 0) {
    actions.push("push_changes");
  }

  if (reviewerUpdates?.awaiting && !reviewerUpdates?.hasNewUpdates && actions.length === 0) {
    return ["wait"];
  }

  if (
    unresolvedThreadCount === 0 &&
    !effectiveDirty &&
    pullRequest &&
    pullRequest.reviewDecision !== "APPROVED" &&
    (session?.reviewRoundsRemaining ?? 0) > 0
  ) {
    actions.push("request_review");
  }

  if (actions.length === 0) {
    actions.push("wait");
  }

  return [...new Set(actions)];
}

// ---------------------------------------------------------------------------
// Approval heuristics
// ---------------------------------------------------------------------------

const APPROVAL_PATTERNS = [
  /\blgtm\b/i,
  /\bapproved?\b/i,
  /\blooks?\s+good\b/i,
  /\bno\s+more\s+changes?\b/i,
  /\bship\s+it\b/i,
];

export function isApprovalComment(text) {
  if (!text || typeof text !== "string") {
    return false;
  }

  return APPROVAL_PATTERNS.some((pattern) => pattern.test(text));
}

// ---------------------------------------------------------------------------
// Reviewer satisfaction
// ---------------------------------------------------------------------------

/**
 * Evaluate whether each selected reviewer is satisfied.
 *
 * Returns:
 * {
 *   allSatisfied: boolean,
 *   reviewers: [{ login, satisfied, via }]
 * }
 *
 * A reviewer is satisfied if:
 *   1. Their latest GitHub review state is APPROVED, or
 *   2. They posted an approval-like comment (from prComments or review
 *      thread comments) AFTER the last change was published
 *      (`lastPublishedChangeAt`).
 */
export function evaluateReviewerSatisfaction({
  pullRequest,
  prComments,
  threads,
  selectedReviewers,
  lastPublishedChangeAt,
}) {
  const cutoff = lastPublishedChangeAt ? Date.parse(lastPublishedChangeAt) : 0;
  const results = [];

  for (const reviewer of selectedReviewers ?? []) {
    const login = String(reviewer).replace(/^@/, "").toLowerCase();
    let satisfied = false;
    let via = null;

    // 1. Check explicit GitHub review approval (latest review from this reviewer)
    const reviews = pullRequest?.reviews ?? [];
    const reviewerReviews = reviews
      .filter((r) => String(r?.author?.login ?? "").toLowerCase() === login)
      .sort((a, b) => {
        const ta = Date.parse(a?.submittedAt ?? 0);
        const tb = Date.parse(b?.submittedAt ?? 0);
        return tb - ta;
      });

    if (reviewerReviews.length > 0) {
      const latest = reviewerReviews[0];
      if (latest.state === "APPROVED") {
        const submittedAt = Date.parse(latest.submittedAt ?? 0);
        if (!cutoff || submittedAt >= cutoff) {
          satisfied = true;
          via = "review_approved";
        }
      }
    }

    // 2. Check approval-like PR issue comments (top-level comments)
    if (!satisfied) {
      for (const comment of prComments ?? []) {
        const authorLogin = String(comment?.author?.login ?? comment?.author ?? "").toLowerCase();
        if (authorLogin !== login) {
          continue;
        }
        const createdAt = Date.parse(comment?.createdAt ?? 0);
        if (cutoff && createdAt < cutoff) {
          continue;
        }
        if (isApprovalComment(comment?.body)) {
          satisfied = true;
          via = "comment_approved";
          break;
        }
      }
    }

    // 3. Check approval-like review thread comments
    if (!satisfied) {
      outer: for (const thread of threads ?? []) {
        for (const comment of thread?.comments ?? []) {
          const authorLogin = String(comment?.author ?? "").toLowerCase();
          if (authorLogin !== login) {
            continue;
          }
          const createdAt = Date.parse(comment?.createdAt ?? 0);
          if (cutoff && createdAt < cutoff) {
            continue;
          }
          if (isApprovalComment(comment?.body)) {
            satisfied = true;
            via = "thread_comment_approved";
            break outer;
          }
        }
      }
    }

    results.push({ login, satisfied, via });
  }

  return {
    allSatisfied: results.length > 0 && results.every((r) => r.satisfied),
    reviewers: results,
  };
}

// ---------------------------------------------------------------------------
// Publish status (richer than dirty/clean)
// ---------------------------------------------------------------------------

/**
 * Interpret the raw working-copy + ref data into a publish-oriented status.
 *
 * Fields:
 *   hasUncommittedChanges - local file modifications not yet committed
 *   hasCommittedUnpublishedChanges - committed/bookmarked but not pushed to remote
 *   hasUnpushedCommits    - anything still needs local VCS action before review can continue
 *   needsCommitBeforePush - uncommitted changes exist
 *   ambiguous             - current publish target is unclear (for example no bookmark at @)
 *   ready                 - nothing to commit or push
 */
export function getPublishStatus(workingCopy, refContext) {
  const vcs = workingCopy?.vcs ?? refContext?.vcs ?? null;
  const hasUncommittedChanges = workingCopy?.dirty ?? false;

  if (vcs === "jj") {
    const bookmarks = Array.isArray(refContext?.bookmarks) ? refContext.bookmarks : [];
    const inspection = refContext?.publishInspection ?? {};
    const ambiguous = bookmarks.length === 0;
    const pendingBookmarks = Array.isArray(inspection?.pendingBookmarks)
      ? inspection.pendingBookmarks
      : [];
    const hasCommittedUnpublishedChanges = Boolean(
      !hasUncommittedChanges && !ambiguous && (inspection?.hasPendingChanges ?? false),
    );
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

    const hasUnpushedCommits =
      hasUncommittedChanges || ambiguous || hasCommittedUnpublishedChanges || Boolean(inspection?.error);

    return {
      vcs: "jj",
      publishKind: "bookmark",
      state,
      ambiguous,
      bookmarks,
      primaryRef: bookmarks[0] ?? null,
      remote: inspection?.remote ?? null,
      checked: Boolean(inspection?.checked),
      pendingBookmarks,
      hasUncommittedChanges,
      hasCommittedUnpublishedChanges,
      hasUnpushedCommits,
      needsCommitBeforePush: hasUncommittedChanges,
      ready: !hasUnpushedCommits,
      warnings,
      nextSteps,
      dryRunOutput: inspection?.raw ?? null,
    };
  }

  // For git, check if branch info says "ahead"
  let hasUnpushedCommits = false;
  if (vcs === "git" && typeof workingCopy.raw === "string") {
    hasUnpushedCommits = /\bahead\b/i.test(workingCopy.raw);
  }

  // If there are uncommitted changes, we still consider there is something to push
  // after the user commits
  if (hasUncommittedChanges) {
    hasUnpushedCommits = true;
  }

  const branch = refContext?.branch ?? refContext?.primaryRef ?? null;
  const hasCommittedUnpublishedChanges = !hasUncommittedChanges && hasUnpushedCommits;
  const nextSteps = [];

  if (hasUncommittedChanges) {
    nextSteps.push("Review the working tree with `git status` and `git diff`.");
    nextSteps.push("Create a commit before pushing.");
  } else if (hasCommittedUnpublishedChanges) {
    nextSteps.push("Push the current branch before requesting another review round.");
  }

  return {
    vcs,
    publishKind: vcs === "git" ? "branch" : null,
    state: hasUncommittedChanges ? "needs_commit" : hasUnpushedCommits ? "needs_publish" : "ready",
    ambiguous: false,
    branch,
    primaryRef: branch,
    hasUncommittedChanges,
    hasCommittedUnpublishedChanges,
    hasUnpushedCommits,
    needsCommitBeforePush: hasUncommittedChanges,
    ready: !hasUncommittedChanges && !hasUnpushedCommits,
    warnings: [],
    nextSteps,
  };
}

// ---------------------------------------------------------------------------
// Review-loop phase machine
// ---------------------------------------------------------------------------

export const REVIEW_LOOP_PHASES = {
  STARTING: "starting",
  NEEDS_PR: "needs_pr",
  NEEDS_REVIEWER: "needs_reviewer",
  NEEDS_PUBLISH: "needs_publish",
  WAITING_FOR_REVIEW: "waiting_for_review",
  REVIEW_FEEDBACK_RECEIVED: "review_feedback_received",
  NEEDS_PUSH_REFILL: "needs_push_refill",
  COMPLETED: "completed",
};

/**
 * Determine the current review-loop phase from a workflow snapshot.
 */
export function getReviewLoopPhase({
  session,
  hasPullRequest,
  currentReviewers,
  reviewerUpdates,
  unresolvedThreadCount,
  satisfaction,
  publishStatus,
}) {
  if (!hasPullRequest) {
    return REVIEW_LOOP_PHASES.NEEDS_PR;
  }

  if (!currentReviewers || currentReviewers.length === 0) {
    return REVIEW_LOOP_PHASES.NEEDS_REVIEWER;
  }

  if (satisfaction?.allSatisfied && !publishStatus?.hasUnpushedCommits) {
    return REVIEW_LOOP_PHASES.COMPLETED;
  }

  const hasNewFeedback =
    reviewerUpdates?.hasNewUpdates || unresolvedThreadCount > 0;

  if (hasNewFeedback) {
    if (
      publishStatus?.hasUnpushedCommits &&
      !publishStatus?.ambiguous &&
      (session?.pushesRemaining ?? 0) <= 0
    ) {
      return REVIEW_LOOP_PHASES.NEEDS_PUSH_REFILL;
    }
    return REVIEW_LOOP_PHASES.REVIEW_FEEDBACK_RECEIVED;
  }

  if (publishStatus?.hasUnpushedCommits) {
    if (!publishStatus?.ambiguous && (session?.pushesRemaining ?? 0) <= 0) {
      return REVIEW_LOOP_PHASES.NEEDS_PUSH_REFILL;
    }

    return REVIEW_LOOP_PHASES.NEEDS_PUBLISH;
  }

  return REVIEW_LOOP_PHASES.WAITING_FOR_REVIEW;
}

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a polling cycle found new review activity.
 * Compares `reviewerUpdates` from the current snapshot.
 */
export function hasNewReviewActivity(reviewerUpdates) {
  return reviewerUpdates?.hasNewUpdates === true;
}

/**
 * Normalize reviewer logins from a PR's reviewRequests field.
 * Handles both user logins and team slugs.
 */
export function normalizeRequestedReviewers(pullRequest) {
  const requests = pullRequest?.reviewRequests ?? [];
  const reviewers = [];

  for (const entry of requests) {
    if (entry?.login) {
      reviewers.push(entry.login);
    } else if (entry?.slug) {
      const org = entry?.organization?.login;
      reviewers.push(org ? `${org}/${entry.slug}` : entry.slug);
    } else if (typeof entry === "string") {
      reviewers.push(entry);
    }
  }

  return reviewers;
}
