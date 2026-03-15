import test from "node:test";
import assert from "node:assert/strict";

import {
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
} from "../gh_repo_workflow_logic.mjs";

test("getWorkflowNextActions prioritizes replies and pushes dirty changes", () => {
  const actions = getWorkflowNextActions({
    session: { pushesRemaining: 1, reviewRoundsRemaining: 1 },
    unresolvedThreadCount: 2,
    pullRequest: { reviewDecision: "CHANGES_REQUESTED" },
    workingCopy: { dirty: true },
    reviewerUpdates: { awaiting: false, hasNewUpdates: false },
  });

  assert.deepEqual(actions, ["review_threads", "reply_and_resolve", "push_changes"]);
});

test("getWorkflowNextActions requests review only when clean and unresolved-free", () => {
  const actions = getWorkflowNextActions({
    session: { pushesRemaining: 1, reviewRoundsRemaining: 2 },
    unresolvedThreadCount: 0,
    pullRequest: { reviewDecision: "REVIEW_REQUIRED" },
    workingCopy: { dirty: false },
    reviewerUpdates: { awaiting: false, hasNewUpdates: false },
  });

  assert.deepEqual(actions, ["request_review"]);
});

test("chooseWorkflowAction prefers reply over push over request review", () => {
  assert.equal(
    chooseWorkflowAction(["request_review", "push_changes", "reply_and_resolve"], "auto"),
    "reply_and_resolve",
  );
  assert.equal(chooseWorkflowAction(["push_changes"], "push"), "push_changes");
});

test("getBlockingWorkflowStopReasons only blocks actions on relevant reasons", () => {
  assert.deepEqual(
    getBlockingWorkflowStopReasons("reply_and_resolve", ["push_budget_exhausted"]),
    [],
  );
  assert.deepEqual(
    getBlockingWorkflowStopReasons("push_changes", ["push_budget_exhausted"]),
    ["push_budget_exhausted"],
  );
});

test("syncReviewerUpdateState clears awaiting flag when new updates arrive", () => {
  const session = { awaitingReviewUpdates: true, updatedAt: "2026-01-01T00:00:00.000Z" };
  const reviewerUpdates = { awaiting: true, hasNewUpdates: true };

  const changed = syncReviewerUpdateState(session, reviewerUpdates);

  assert.equal(changed, true);
  assert.equal(session.awaitingReviewUpdates, false);
  assert.equal(reviewerUpdates.awaiting, false);
  assert.notEqual(session.updatedAt, "2026-01-01T00:00:00.000Z");
});

test("getReviewerUpdateSummary filters updates after last request", () => {
  const summary = getReviewerUpdateSummary({
    session: {
      awaitingReviewUpdates: true,
      lastReviewRequestedAt: "2026-01-01T00:00:00.000Z",
      defaultReviewers: ["@copilot"],
    },
    reviewerFilter: undefined,
    pullRequest: {
      reviews: [
        {
          author: { login: "copilot" },
          submittedAt: "2026-01-02T00:00:00.000Z",
          state: "COMMENTED",
          id: "r1",
        },
        {
          author: { login: "someone-else" },
          submittedAt: "2026-01-03T00:00:00.000Z",
          state: "COMMENTED",
          id: "r2",
        },
      ],
    },
    threads: [
      {
        id: "t1",
        path: "src/app.js",
        comments: [
          {
            author: "copilot",
            createdAt: "2026-01-02T01:00:00.000Z",
            databaseId: 11,
          },
        ],
      },
    ],
  });

  assert.equal(summary.awaiting, true);
  assert.equal(summary.hasNewUpdates, true);
  assert.equal(summary.updates.length, 2);
});

test("getChecksSummary distinguishes passing, pending, and failing checks", () => {
  const checks = getChecksSummary({
    statusCheckRollup: [
      {
        __typename: "CheckRun",
        name: "test",
        status: "COMPLETED",
        conclusion: "SUCCESS",
      },
      {
        __typename: "CheckRun",
        name: "lint",
        status: "IN_PROGRESS",
        conclusion: null,
      },
      {
        __typename: "StatusContext",
        context: "deploy",
        status: "COMPLETED",
        state: "FAILURE",
      },
    ],
  });

  assert.equal(checks.total, 3);
  assert.equal(checks.pending, 1);
  assert.equal(checks.failing, 1);
  assert.equal(checks.passing, false);
});

test("getWorkflowStopReasons reports configured stop conditions and waiting state", () => {
  const reasons = getWorkflowStopReasons({
    session: {
      stopWhenApproved: true,
      stopWhenChecksPass: true,
      stopWhenNoUnresolvedThreads: false,
      pushesRemaining: 0,
      reviewRoundsRemaining: 0,
    },
    unresolvedThreadCount: 1,
    pullRequest: { reviewDecision: "APPROVED" },
    workingCopy: { dirty: false },
    checksPass: true,
    reviewerUpdates: { awaiting: true, hasNewUpdates: false },
    afterRequestReview: false,
  });

  assert.deepEqual(reasons.sort(), [
    "approved_and_checks_passing",
    "awaiting_code_changes_or_reply",
    "push_budget_exhausted",
    "review_round_budget_exhausted",
    "waiting_for_review_updates",
  ]);
});

// ---------------------------------------------------------------------------
// isApprovalComment
// ---------------------------------------------------------------------------

test("isApprovalComment recognizes lgtm", () => {
  assert.equal(isApprovalComment("LGTM"), true);
  assert.equal(isApprovalComment("lgtm!"), true);
  assert.equal(isApprovalComment("  lgtm  "), true);
});

test("isApprovalComment recognizes approval phrases", () => {
  assert.equal(isApprovalComment("Approved"), true);
  assert.equal(isApprovalComment("looks good to me"), true);
  assert.equal(isApprovalComment("Looks good"), true);
  assert.equal(isApprovalComment("no more changes needed"), true);
  assert.equal(isApprovalComment("ship it"), true);
});

test("isApprovalComment rejects non-approval text", () => {
  assert.equal(isApprovalComment("Please fix this"), false);
  assert.equal(isApprovalComment("I have some concerns"), false);
  assert.equal(isApprovalComment("needs work"), false);
});

test("isApprovalComment handles edge cases", () => {
  assert.equal(isApprovalComment(""), false);
  assert.equal(isApprovalComment(null), false);
  assert.equal(isApprovalComment(undefined), false);
  assert.equal(isApprovalComment(42), false);
});

// ---------------------------------------------------------------------------
// evaluateReviewerSatisfaction
// ---------------------------------------------------------------------------

test("evaluateReviewerSatisfaction detects explicit GitHub APPROVED review", () => {
  const result = evaluateReviewerSatisfaction({
    pullRequest: {
      reviews: [
        {
          author: { login: "alice" },
          submittedAt: "2026-03-01T12:00:00.000Z",
          state: "APPROVED",
        },
      ],
    },
    prComments: [],
    threads: [],
    selectedReviewers: ["alice"],
    lastPublishedChangeAt: "2026-03-01T10:00:00.000Z",
  });

  assert.equal(result.allSatisfied, true);
  assert.equal(result.reviewers[0].satisfied, true);
  assert.equal(result.reviewers[0].via, "review_approved");
});

test("evaluateReviewerSatisfaction treats stale approval as unsatisfied", () => {
  const result = evaluateReviewerSatisfaction({
    pullRequest: {
      reviews: [
        {
          author: { login: "alice" },
          submittedAt: "2026-03-01T08:00:00.000Z",
          state: "APPROVED",
        },
      ],
    },
    prComments: [],
    threads: [],
    selectedReviewers: ["alice"],
    lastPublishedChangeAt: "2026-03-01T10:00:00.000Z",
  });

  assert.equal(result.allSatisfied, false);
  assert.equal(result.reviewers[0].satisfied, false);
});

test("evaluateReviewerSatisfaction recognizes approval-like PR comment", () => {
  const result = evaluateReviewerSatisfaction({
    pullRequest: { reviews: [] },
    prComments: [
      {
        author: { login: "bob" },
        body: "LGTM, ship it!",
        createdAt: "2026-03-02T12:00:00.000Z",
      },
    ],
    threads: [],
    selectedReviewers: ["bob"],
    lastPublishedChangeAt: "2026-03-02T10:00:00.000Z",
  });

  assert.equal(result.allSatisfied, true);
  assert.equal(result.reviewers[0].via, "comment_approved");
});

test("evaluateReviewerSatisfaction recognizes approval in thread comment", () => {
  const result = evaluateReviewerSatisfaction({
    pullRequest: { reviews: [] },
    prComments: [],
    threads: [
      {
        id: "t1",
        comments: [
          {
            author: "carol",
            body: "Looks good now, approved",
            createdAt: "2026-03-03T12:00:00.000Z",
          },
        ],
      },
    ],
    selectedReviewers: ["carol"],
    lastPublishedChangeAt: "2026-03-03T10:00:00.000Z",
  });

  assert.equal(result.allSatisfied, true);
  assert.equal(result.reviewers[0].via, "thread_comment_approved");
});

test("evaluateReviewerSatisfaction requires ALL reviewers satisfied", () => {
  const result = evaluateReviewerSatisfaction({
    pullRequest: {
      reviews: [
        {
          author: { login: "alice" },
          submittedAt: "2026-03-01T12:00:00.000Z",
          state: "APPROVED",
        },
      ],
    },
    prComments: [],
    threads: [],
    selectedReviewers: ["alice", "bob"],
    lastPublishedChangeAt: "2026-03-01T10:00:00.000Z",
  });

  assert.equal(result.allSatisfied, false);
  assert.equal(result.reviewers[0].satisfied, true);
  assert.equal(result.reviewers[1].satisfied, false);
});

test("evaluateReviewerSatisfaction handles @ prefix on reviewer names", () => {
  const result = evaluateReviewerSatisfaction({
    pullRequest: {
      reviews: [
        {
          author: { login: "copilot" },
          submittedAt: "2026-03-01T12:00:00.000Z",
          state: "APPROVED",
        },
      ],
    },
    prComments: [],
    threads: [],
    selectedReviewers: ["@copilot"],
    lastPublishedChangeAt: null,
  });

  assert.equal(result.allSatisfied, true);
});

// ---------------------------------------------------------------------------
// getPublishStatus
// ---------------------------------------------------------------------------

test("getPublishStatus detects uncommitted changes", () => {
  const status = getPublishStatus({ dirty: true, vcs: "git", raw: "## main" }, {});
  assert.equal(status.hasUncommittedChanges, true);
  assert.equal(status.hasUnpushedCommits, true);
  assert.equal(status.needsCommitBeforePush, true);
  assert.equal(status.ready, false);
});

test("getPublishStatus detects unpushed commits via ahead", () => {
  const status = getPublishStatus(
    { dirty: false, vcs: "git", raw: "## main...origin/main [ahead 2]" },
    {},
  );
  assert.equal(status.hasUncommittedChanges, false);
  assert.equal(status.hasUnpushedCommits, true);
  assert.equal(status.needsCommitBeforePush, false);
  assert.equal(status.ready, false);
});

test("getPublishStatus reports ready when clean and synced", () => {
  const status = getPublishStatus(
    { dirty: false, vcs: "git", raw: "## main...origin/main" },
    {},
  );
  assert.equal(status.hasUncommittedChanges, false);
  assert.equal(status.hasUnpushedCommits, false);
  assert.equal(status.ready, true);
});

// ---------------------------------------------------------------------------
// getReviewLoopPhase
// ---------------------------------------------------------------------------

test("getReviewLoopPhase returns NEEDS_PR when no PR exists", () => {
  const phase = getReviewLoopPhase({
    session: {},
    hasPullRequest: false,
    currentReviewers: [],
    reviewerUpdates: {},
    unresolvedThreadCount: 0,
    satisfaction: { allSatisfied: false, reviewers: [] },
    publishStatus: { hasUnpushedCommits: false },
  });
  assert.equal(phase, REVIEW_LOOP_PHASES.NEEDS_PR);
});

test("getReviewLoopPhase returns NEEDS_REVIEWER when no reviewers", () => {
  const phase = getReviewLoopPhase({
    session: {},
    hasPullRequest: true,
    currentReviewers: [],
    reviewerUpdates: {},
    unresolvedThreadCount: 0,
    satisfaction: { allSatisfied: false, reviewers: [] },
    publishStatus: { hasUnpushedCommits: false },
  });
  assert.equal(phase, REVIEW_LOOP_PHASES.NEEDS_REVIEWER);
});

test("getReviewLoopPhase returns COMPLETED when all satisfied", () => {
  const phase = getReviewLoopPhase({
    session: {},
    hasPullRequest: true,
    currentReviewers: ["alice"],
    reviewerUpdates: { hasNewUpdates: false },
    unresolvedThreadCount: 0,
    satisfaction: { allSatisfied: true, reviewers: [{ login: "alice", satisfied: true }] },
    publishStatus: { hasUnpushedCommits: false },
  });
  assert.equal(phase, REVIEW_LOOP_PHASES.COMPLETED);
});

test("getReviewLoopPhase returns REVIEW_FEEDBACK_RECEIVED on new updates", () => {
  const phase = getReviewLoopPhase({
    session: { pushesRemaining: 1 },
    hasPullRequest: true,
    currentReviewers: ["alice"],
    reviewerUpdates: { hasNewUpdates: true },
    unresolvedThreadCount: 2,
    satisfaction: { allSatisfied: false, reviewers: [] },
    publishStatus: { hasUnpushedCommits: false },
  });
  assert.equal(phase, REVIEW_LOOP_PHASES.REVIEW_FEEDBACK_RECEIVED);
});

test("getReviewLoopPhase returns NEEDS_PUSH_REFILL when budget exhausted with unpushed commits", () => {
  const phase = getReviewLoopPhase({
    session: { pushesRemaining: 0 },
    hasPullRequest: true,
    currentReviewers: ["alice"],
    reviewerUpdates: { hasNewUpdates: true },
    unresolvedThreadCount: 1,
    satisfaction: { allSatisfied: false, reviewers: [] },
    publishStatus: { hasUnpushedCommits: true },
  });
  assert.equal(phase, REVIEW_LOOP_PHASES.NEEDS_PUSH_REFILL);
});

test("getReviewLoopPhase returns WAITING_FOR_REVIEW when idle", () => {
  const phase = getReviewLoopPhase({
    session: { pushesRemaining: 2 },
    hasPullRequest: true,
    currentReviewers: ["alice"],
    reviewerUpdates: { hasNewUpdates: false },
    unresolvedThreadCount: 0,
    satisfaction: { allSatisfied: false, reviewers: [] },
    publishStatus: { hasUnpushedCommits: false },
  });
  assert.equal(phase, REVIEW_LOOP_PHASES.WAITING_FOR_REVIEW);
});

// ---------------------------------------------------------------------------
// hasNewReviewActivity
// ---------------------------------------------------------------------------

test("hasNewReviewActivity returns true when updates exist", () => {
  assert.equal(hasNewReviewActivity({ hasNewUpdates: true }), true);
});

test("hasNewReviewActivity returns false when no updates", () => {
  assert.equal(hasNewReviewActivity({ hasNewUpdates: false }), false);
  assert.equal(hasNewReviewActivity(null), false);
  assert.equal(hasNewReviewActivity(undefined), false);
});

// ---------------------------------------------------------------------------
// normalizeRequestedReviewers
// ---------------------------------------------------------------------------

test("normalizeRequestedReviewers extracts logins from reviewRequests", () => {
  const reviewers = normalizeRequestedReviewers({
    reviewRequests: [
      { login: "alice" },
      { slug: "core-team", organization: { login: "myorg" } },
      "bob",
    ],
  });
  assert.deepEqual(reviewers, ["alice", "myorg/core-team", "bob"]);
});

test("normalizeRequestedReviewers returns empty for no requests", () => {
  assert.deepEqual(normalizeRequestedReviewers({}), []);
  assert.deepEqual(normalizeRequestedReviewers(null), []);
});

test("normalizeRequestedReviewers handles team without org", () => {
  const reviewers = normalizeRequestedReviewers({
    reviewRequests: [{ slug: "reviewers" }],
  });
  assert.deepEqual(reviewers, ["reviewers"]);
});

// ---------------------------------------------------------------------------
// getWorkflowNextActions with publishStatus override
// ---------------------------------------------------------------------------

test("getWorkflowNextActions uses publishStatus.hasUnpushedCommits over workingCopy.dirty", () => {
  // workingCopy says dirty, but publishStatus says no unpushed commits (just uncommitted)
  // This shouldn't happen in practice, but tests the override logic
  const actions = getWorkflowNextActions({
    session: { pushesRemaining: 1, reviewRoundsRemaining: 1 },
    unresolvedThreadCount: 0,
    pullRequest: { reviewDecision: "REVIEW_REQUIRED" },
    workingCopy: { dirty: false },
    reviewerUpdates: { awaiting: false, hasNewUpdates: false },
    publishStatus: { hasUnpushedCommits: true },
  });

  // publishStatus says there ARE unpushed commits, so push should be an action
  assert.ok(actions.includes("push_changes"));
});

test("getWorkflowNextActions falls back to workingCopy.dirty when publishStatus absent", () => {
  const actions = getWorkflowNextActions({
    session: { pushesRemaining: 1, reviewRoundsRemaining: 1 },
    unresolvedThreadCount: 0,
    pullRequest: { reviewDecision: "REVIEW_REQUIRED" },
    workingCopy: { dirty: true },
    reviewerUpdates: { awaiting: false, hasNewUpdates: false },
  });

  assert.ok(actions.includes("push_changes"));
});
