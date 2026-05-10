---
name: dotnet-upgrade
description: 'Analyze and execute a .NET framework or package upgrade: assess current state, identify breaking changes, update target frameworks and NuGet packages, and verify the build.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Analyze and execute a .NET upgrade for the solution.

## Stack
- **CLI:** `dotnet` SDK (key commands: `dotnet build`, `dotnet test`, `dotnet outdated`)
- **Package manager:** NuGet (via `Directory.Packages.props` or `.csproj`)
Assesses the current .NET version and package state, plans the upgrade path, applies changes, and verifies the solution builds and tests pass.

## Steps

### Phase 1 — Assess
1. Identify all projects in the solution and their `TargetFramework` values
2. Identify project types (`.NET Framework`, `.NET Core`, `.NET Standard`)
3. List all NuGet packages and current versions
4. Use `dotnet outdated` (if available) to identify outdated packages

### Phase 2 — Plan
5. Determine target framework version (ask if not specified)
6. Check [.NET release notes](https://learn.microsoft.com/en-us/dotnet/core/whats-new/) for breaking changes
7. Identify packages that require version bumps or have been renamed/deprecated

### Phase 3 — Execute
8. Update `TargetFramework` in all `.csproj` files (or `Directory.Build.props`)
9. Update NuGet package versions in `Directory.Packages.props` (or individual `.csproj`)
10. Fix any breaking API changes in source code
11. Run `dotnet build` and fix compiler errors
12. Run `dotnet test` and fix failing tests

## Constraints
- Update `Directory.Packages.props` centrally when Central Package Management is in use
- Document breaking changes addressed in commit message
- Do not upgrade to pre-release versions unless explicitly requested

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
