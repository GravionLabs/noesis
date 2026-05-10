---
name: dotnet-ef-core
description: 'Apply Entity Framework Core best practices: DbContext design, migrations, query optimization, owned entities, and avoiding N+1 problems.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Apply Entity Framework Core best practices to the specified code.

## Stack
- **CLI:** `dotnet` SDK + `dotnet-ef` tool (key commands: `dotnet ef migrations add`, `dotnet ef database update`, `dotnet build`)
- **Package manager:** NuGet — `Microsoft.EntityFrameworkCore`, provider packages
Reviews and improves EF Core usage: DbContext configuration, entity design, migrations, query patterns, and performance.

## Key rules

### DbContext
- Register with `AddDbContext<T>` using Scoped lifetime (default)
- Use `IDbContextFactory<T>` for background services or parallel queries
- Never inject `DbContext` as Singleton

### Entity configuration
- Use Fluent API in `IEntityTypeConfiguration<T>` classes — not data annotations
- Configure owned entities with `OwnsOne` / `OwnsMany`
- Always configure string lengths to avoid `nvarchar(max)`

### Queries
- Use `AsNoTracking()` for read-only queries
- Avoid N+1: use `Include` / `ThenInclude` or split queries
- Use `Select` projections — do not load full entities when only a few properties are needed
- Use `AsSplitQuery()` for complex includes with collections

### Migrations
- Name migrations descriptively: `AddUserEmailIndex`, not `Migration1`
- Never edit generated migration files — add a new migration instead
- Run `dotnet ef migrations add <Name>` and review before applying

### Transactions
- Use `IDbContextTransaction` for multi-step operations requiring atomicity

## Steps
1. Read target code and identify EF Core violations
2. Apply fixes — query optimizations first, then design improvements
3. Run `dotnet build` to confirm no compilation errors

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
