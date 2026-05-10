---
name: dotnet-best-practices
description: 'Review and improve .NET/C# code to meet project-specific best practices: nullability, async patterns, DI, logging, and modern C# idioms.'
allowed-tools: read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Ensure .NET/C# code meets best practices for the solution.

## What this skill does
Reviews the specified code against project-specific and general .NET best practices, then applies improvements. Reads existing code patterns to stay consistent with the project.

## Key areas

### Modern C# idioms
- Enable `<Nullable>enable</Nullable>` and resolve all warnings
- Use `record` types for immutable data transfer objects
- Use primary constructors, collection expressions, and pattern matching where they improve clarity
- Prefer `is null` / `is not null` over `== null`

### Async
- `Async` suffix on all async methods
- Pass `CancellationToken` through I/O chains
- No `.Result`/`.Wait()` — use `await` throughout

### Dependency injection
- Register services with appropriate lifetimes (Singleton / Scoped / Transient)
- Inject via constructor — no service locator pattern

### Logging
- Use `ILogger<T>` — not `Console.WriteLine`
- Use structured logging with named parameters: `_logger.LogInformation("User {UserId} created", id)`

### Error handling
- Use specific exception types
- Do not swallow exceptions with empty `catch` blocks

## Steps
1. Read the target file(s) and project conventions
2. List all violations found
3. Apply fixes, staying consistent with existing style

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
