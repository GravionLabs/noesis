---
name: dotnet-code-review
description: 'Perform a structured C# and NUnit code review with priority ratings: 🔴 critical bugs/security, 🟡 important improvements, 🟢 suggestions.'
allowed-tools: read search codebase
model: claude-sonnet-4.6
---

Review C# code for correctness, readability, maintainability, and security.

## What this skill does
Provides a structured code review with prioritized findings. Does not modify code — outputs findings only.

## Priority ratings
- 🔴 **Critical** — bugs, security vulnerabilities, data loss risk, broken tests
- 🟡 **Important** — performance issues, missing error handling, API design problems
- 🟢 **Suggestion** — style improvements, naming, minor refactors

## Review checklist

### C# code quality
- Use C# 12+ features appropriately (primary constructors, collection expressions, pattern matching)
- Proper `async`/`await` usage — no `.Result`/`.Wait()`, no `async void`
- `CancellationToken` propagated through async call chains
- Null safety — nullable reference types enabled and respected
- Exception handling — no swallowed exceptions, appropriate exception types

### Design
- SOLID principles — single responsibility, dependency injection
- No tight coupling — dependencies injected via interfaces
- Appropriate use of `record` vs `class`

### NUnit tests
- Tests follow `MethodName_Scenario_ExpectedResult` naming
- AAA structure (Arrange / Act / Assert)
- No shared mutable state between tests
- Meaningful assertions — not just `Assert.NotNull`

## Output format
Group findings by file. For each finding: priority emoji, location, explanation, suggested fix.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
