# GitHub Repo Tools

Custom OpenCode tools for GitHub workflows with repo whitelisting, review handling, and push budgeting.

## Files

- `gh_repo.js` - exports the GitHub workflow tool family
- `gh_repo_workflow_logic.mjs` - pure functions for workflow decisions, phase detection, approval heuristics
- `jj.js` - advisory jj-first local workflow guidance

## Tool names

Because the file exports multiple tools, OpenCode exposes them as:

- `gh_repo_session`
- `gh_repo_whitelist`
- `gh_repo_prs`
- `gh_repo_reviews`
- `gh_repo_comment`
- `gh_repo_request_review`
- `gh_repo_push`
- `gh_repo_summary`
- `gh_repo_workflow`
- `jj`

## Behavior

- Prefers `jj` over `git` when detecting the current repo.
- Uses a persistent whitelist stored in `~/.config/opencode/gh-workflow-state.json`.
- On first use in a repo, prompts whether that repo should be added to the whitelist.
- Tracks a per-session push budget, review-round budget, and default reviewers.
- Persists selected reviewers and last published change timestamps for review-loop continuity.
- Supports stop conditions for `no unresolved review threads`, `PR approved`, and `checks passing`.
- Defaults review requests to `@copilot`.
- In jj repos, distinguishes between uncommitted work, unpublished bookmark changes, and ambiguous publish state when no bookmark points at `@`.

## Typical flow

1. `gh_repo_workflow` is triggered; if the session is not configured yet, it prompts for workflow budget setup and requires `gh_repo_session configure`.
2. `gh_repo_session` with `operation: "configure"` sets `pushes_remaining`, `review_rounds_remaining`, `stop_when_approved`, `stop_when_checks_pass`, optional `notes`, and can persist reviewer defaults.
3. `gh_repo_workflow` with `operation: "status"` or `gh_repo_summary` inspects the current PR, unresolved threads, checks, publish state, budget, and suggested next actions.
4. Read unresolved comments and implement fixes; `gh_repo_workflow` `advance` can use `reply_and_resolve` to reply to a review comment and resolve its thread.
5. `gh_repo_workflow` `advance` or `gh_repo_push` pushes changes, consuming one push.
6. `gh_repo_workflow` `advance` or `gh_repo_request_review` requests another review from `@copilot`, consumes one review round, and enters a waiting state until reviewer updates arrive.
7. Repeat until budget ends or the reviewer approves and checks are passing.

## Review Loop (`/review-loop`)

An automated PR review cycle triggered by the `/review-loop` slash command. This invokes the `review-loop` agent which orchestrates the full loop:

### How it works

1. **Setup**: Detects repo, ensures whitelist entry, asks user for push budget via `gh_repo_session configure`.
2. **PR**: Ensures a PR exists for the current branch or bookmark (creates one if needed via `gh pr create`).
3. **Reviewers**: Asks the user to select reviewers (or uses session defaults).
4. **Review request**: Requests review from selected reviewers.
5. **Polling**: Calls `gh_repo_workflow` with `operation: "run"`, which blocks and polls GitHub every 30 seconds for up to 1 hour until new review activity appears or all reviewers approve.
6. **Feedback**: When reviews arrive, the agent reads unresolved threads, evaluates each comment, fixes code, replies, and resolves threads.
7. **Commit & push**: Commits fixes, pushes (consuming push budget).
8. **Loop**: Returns to step 4.

### Phases

The review loop tracks its state via phases:

| Phase | Meaning |
|-------|---------|
| `starting` | Loop just began, initializing |
| `needs_pr` | No PR found for current branch or bookmark |
| `needs_reviewer` | PR exists but no reviewers selected |
| `needs_publish` | Local work exists but still needs bookmark setup or publish |
| `waiting_for_review` | Polling GitHub for review activity |
| `review_feedback_received` | New reviews arrived, agent should act |
| `needs_push_refill` | Push budget exhausted, ask user for more |
| `completed` | All reviewers satisfied |

### Push budget

The user sees a "push budget" — the number of push operations the agent is allowed to make. When exhausted, the agent pauses and asks the user for a refill number. Review rounds are managed separately with a generous default (they're cheap).

### Approval detection

A reviewer is considered "satisfied" if:
1. Their latest GitHub review state is `APPROVED` (and newer than the last publish), or
2. They posted an approval-like comment (`lgtm`, `approved`, `looks good`, `no more changes`, `ship it`) after the last publish.

### Cancellation

The polling loop respects `context.abort` (AbortSignal). The user can cancel with ctrl+c.

### Files

- `agents/review-loop.md` - Agent definition with detailed instructions
- `commands/review-loop.md` - Slash command that triggers the agent

## Notes

- Use the `jj` tool when an agent needs jj-native local workflow guidance before a bash call.
- For `jj`, PR autodetection uses bookmarks pointing at `@` and tries to match PR `headRefName`.
- For `jj`, push uses `jj git push --bookmark <bookmark>` for bookmarks pointing at `@` when available.
- For `jj`, publish-state reporting distinguishes missing bookmarks at `@` from bookmark changes that still need publish.
- `set_upstream` only affects Git pushes. On `jj`, it is ignored and returned as a warning.
- `gh_repo_workflow` is an orchestrator: it plans and advances GitHub workflow steps, but it does not edit code by itself.
- `reply_and_resolve` requires `reply_body` plus either `review_comment_id` or `thread_id`.
