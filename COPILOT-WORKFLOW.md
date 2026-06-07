# Copilot workflow tips for Noesis

This repo is mostly about integration-heavy .NET work: Docker/Compose changes, crawler/embedder plumbing, routing bugs, queue naming, docs, and test updates. Use Copilot in a more structured way so those tasks stay fast and predictable.

## 1. Start bigger tasks with a structured prompt

Use this shape for anything that touches multiple files or systems:

- **Objective** — what should change
- **Scope** — which files, folders, or services to inspect
- **Non-goals** — what not to touch
- **Verification** — how to prove it works

Example:

> Change the crawler callback flow. Inspect `server/`, `crawler/`, and queue names in docs. Do not touch embedder logic unless the callback contract requires it. After edits, report the remaining call sites and any test gaps.

This works well for repo-wide changes like Docker, queues, routes, or config.

## 2. Prefer the repo skills for repeated .NET work

When they are available in your Copilot setup, use these first:

- `dotnet-write-tests` for bug fixes, regressions, and edge cases
- `dotnet-nunit` for NUnit/Shouldly test style and conventions
- `dotnet-code-review` for structured review of diffs
- `dotnet-best-practices` for nullability, DI, async, logging, and modern C#
- `dotnet-aspnet-minimal-api-openapi` for new HTTP endpoint modules
- `dotnet-mcp-server-generator` for MCP tooling and server wiring

That keeps boilerplate and conventions consistent without re-explaining them every time.

## 3. Ask for repo-wide sweeps explicitly

If you want a rename or cross-cutting change, say so up front:

- Podman -> Docker / Compose updates
- queue name changes
- crawler/embedder contract changes
- routing or endpoint renames
- docs that must stay in sync with code

Ask for a match report before edits if the change could affect multiple surfaces.

## 4. Use the right level of automation

- **Use the existing skills** for repeatable .NET tasks.
- **Use `/plan`** for larger changes that need a clear objective and verification path.
- **Use a repo-wide search request** when you want all occurrences, not just the first fix.
- **Custom agents** are not configured here yet, so prefer skills and explicit prompts for now.

## 5. Prompt template

> Objective: ...
> Scope: ...
> Non-goals: ...
> Verification: ...
> Search for related occurrences in: ...

Keep prompts short, direct, and specific to the repo area you want changed.
