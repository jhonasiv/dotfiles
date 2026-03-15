# Jujutsu-First Workflow

When `jj workspace root` succeeds, treat the repository as jj-first.

- Use `jj` for local VCS work such as status, diff, history, change naming, splitting, bookmark management, and publishing.
- Use `gh` and the `gh_repo_*` tools for GitHub, pull requests, reviews, comments, and checks.
- Avoid raw local `git` commands in jj repos unless a custom workflow tool is handling GitHub integration internally.
- Prefer bookmark terminology over branch terminology when that distinction matters.
- Prefer `jj describe -m ...` over Git-style commit/amend flows.
- Prefer `jj bookmark create`, `jj bookmark set`, and `jj git push --bookmark <name>` for publishable refs.
- If the correct jj command is unclear, call the `jj` tool for guidance before using bash.
