---
description: Start an automated PR review loop — push, get reviews, fix, repeat until approved.
agent: review-loop
---

Start the automated review loop for the current branch.

1. Detect the repository and ensure it is whitelisted.
2. Ask me for a push budget if the session is not yet configured.
3. Ensure a PR exists for the current branch (create one if needed).
4. Ask me to select reviewers if none are configured.
5. Enter the review-poll-fix-push cycle until all reviewers approve or the budget runs out.

$ARGUMENTS
