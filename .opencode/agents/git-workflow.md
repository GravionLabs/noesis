---
description: Creates branches and PRs per repo convention.
mode: subagent
model: opencode/deepseek-v4-flash-free
permission:
  bash: allow
  edit: allow
---

Load the git-workflow skill. Follow its conventions strictly.

**First step for any issue: create the branch.** No implementation code on main. The flow is:
1. Read the issue
2. `git checkout main && git pull`
3. `git checkout -b <type>/<nr>-<desc>` (based on issue type: feature/bugfix/hotfix/chore)
4. Implement the changes
5. Commit with Conventional Commits (include `Closes #<nr>`)
6. `git push -u origin <branch>`
7. `gh pr create` with the template

Confirm before pushing.
