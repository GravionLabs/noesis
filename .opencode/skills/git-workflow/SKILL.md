---
name: git-workflow
description: >
  Branch/PR conventions for this repo: feature/<nr>-<desc>, bugfix/<nr>-<desc>,
  hotfix/<nr>-<desc>, chore/<nr>-<desc>. Use when user says "create branch",
  "make PR", "branch erstellen", "PR erstellen", "git workflow".
---

Branch and PR rules. Follow exactly. No exceptions.

## Golden Rule

**Create the branch BEFORE writing any implementation code.** When assigned an issue, the first action is always: create the branch with proper naming. No code changes happen on `main`.

## Branch Naming

`<type>/<issue-nr>-<kebab-case-description>`

| Type | Purpose | Base |
|---|---|---|
| `feature` | New features | main |
| `bugfix` | Bug fixes | main |
| `hotfix` | Critical production fixes | main (tag after merge) |
| `chore` | Maintenance, deps, tooling | main |

Issue number is mandatory. Examples:
- `feature/42-add-login`
- `bugfix/17-fix-null-pointer`
- `hotfix/99-security-patch`
- `chore/8-update-deps`

## Commits

Conventional Commits format: `<type>(<scope>): <imperative>`

- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`
- Imperative mood: "add", "fix", "remove" — not "added", "adds"
- Subject ≤50 chars, hard cap 72
- Body includes `Closes #<nr>` when applicable
- No trailing period in subject

## PR Flow

1. `git checkout main && git pull`
2. `git checkout -b <type>/<nr>-<desc>`
3. Stage and commit with Conventional Commits
4. `git push -u origin <branch>`
5. `gh pr create --base main --title "<type>(<scope>): <desc>" --body-file .github/PULL_REQUEST_TEMPLATE.md`
6. Fill in template details

## Pre-PR Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] No debug/console.log left in code
