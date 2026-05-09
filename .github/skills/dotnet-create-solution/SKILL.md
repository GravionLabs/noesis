---
name: dotnet-create-solution
description: 'Scaffold a new .NET solution with src/test layout, Central Package Management (Directory.Packages.props), Directory.Build.props, and .editorconfig. Supports both NuGet libraries (multi-target) and applications (webapi/worker/console).'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---

Scaffold a new .NET solution following the standard project structure.

## Stack
- **CLI:** `dotnet` SDK (key commands: `dotnet new`, `dotnet sln add`, `dotnet build`)
- **Solution format:** `.slnx` (XML-based, default in .NET 9+ SDK)
- **Package manager:** NuGet (via `Directory.Packages.props` — Central Package Management)
- **Scripts:** `pwsh` (PowerShell Core, cross-platform) for the scaffold script

Creates a solution with `src/` and `test/` directories, Central Package Management, shared build configuration, and an `.editorconfig` — ready for development.

## Steps
1. **Ask first:**
   - Solution name
   - **Library** (NuGet package, multi-target `net10.0;net9.0;net8.0`) or **Application** (webapi / worker / console, single `net10.0`)?
   - Project template (classlib / webapi / worker / console / grpc)
   - Additional NuGet packages needed

2. **Run the scaffold script** (recommended — one command creates the full structure):
   ```powershell
   pwsh scripts/New-Solution.ps1 -SolutionName <Name> -ProjectType <template> -OutputType <library|app> [-UpdatePackages]
   ```
   The script:
   - Creates directory structure and `.slnx` solution file
   - Generates source + test projects, strips all redundant properties from `.csproj`
   - Copies all template files (Directory.Build.props, .editorconfig, CI workflow)
   - Optionally updates `Directory.Packages.props` to latest versions (`-UpdatePackages`)
   - Runs `dotnet build` to verify

3. **Alternatively — manual steps:**
   ```bash
   mkdir <SolutionName> && cd <SolutionName>
   dotnet new sln --format slnx -n <SolutionName>
   mkdir -p src test
   dotnet new <template> -n <SolutionName> -o src/<SolutionName>
   dotnet new nunit -n <SolutionName>.Tests -o test/<SolutionName>.Tests
   dotnet sln add src/<SolutionName> test/<SolutionName>.Tests
   dotnet add test/<SolutionName>.Tests reference src/<SolutionName>
   ```

4. Copy template files from `templates/` to the solution root (see `## Templates` below)

5. **Clean generated `.csproj` files** — remove properties already defined in `Directory.Build.props`:
   - Remove from all projects: `TargetFramework`, `ImplicitUsings`, `Nullable`, `LangVersion`
   - Remove from test projects additionally: `IsPackable`, all test `PackageReference`s, `<Using Include="NUnit.Framework"/>`
   - Result: minimal `<Project Sdk="Microsoft.NET.Sdk"></Project>`

6. **Adjust `Directory.Build.props`** based on output type:
   - Library → keep `<TargetFrameworks>net10.0;net9.0;net8.0</TargetFrameworks>` (multi-target)
   - Application → change to `<TargetFramework>net10.0</TargetFramework>` (single target)

7. **Copy the appropriate CI workflow:**
   - Library → `.github/workflows/ci-library.yml` → rename to `ci.yml`, update `verify-package-files`
   - Application → `.github/workflows/ci-app.yml` → rename to `ci.yml`

8. **Update packages** to latest versions:
   ```bash
   # Show outdated packages (no tool required)
   dotnet list package --outdated
   # Or auto-update Directory.Packages.props (requires dotnet-outdated-tool)
   dotnet tool install -g dotnet-outdated-tool
   dotnet outdated --upgrade
   ```

9. Add any additional packages to `Directory.Packages.props` + reference them without `Version` in `.csproj`

10. Run `dotnet build` to verify

## Templates
Starter files are available in `templates/` alongside this skill and get copied automatically when installing the plugin:

| File | Purpose |
|---|---|
| `Directory.Build.props` | Shared MSBuild: `LangVersion=Latest`, `GenerateDocumentationFile`, `NoWarn`. Multi-target for libraries; switch to single `<TargetFramework>` for apps. |
| `Directory.Packages.props` | CPM stub with all NUnit 4 test packages (NUnit 4.5.1, NUnit.Analyzers 4.11.2, NSubstitute, Shouldly, coverlet 8.0.0) + `Microsoft.SourceLink.GitHub` |
| `src/Directory.Build.props` | Imports root props, sets `OutputPath` |
| `test/Directory.Build.props` | Imports root, `IsPackable=false`, all test `PackageReference`s without versions, global `Using NUnit.Framework` |
| `.editorconfig` | Comprehensive C# style: file-scoped namespaces, primary constructors, `_camelCase` fields, analyzer severities, ReSharper/Rider support |
| `.github/workflows/ci-library.yml` | NuGet library CI via `GravionLabs/ci` reusable workflow (build, test, pack, publish) |
| `.github/workflows/ci-app.yml` | Application CI: `dotnet build` + `dotnet test` with test results reporter |

## Scripts
- **`scripts/New-Solution.ps1`** — Full scaffold automation. Run with `pwsh`:
  ```powershell
  pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Core" -ProjectType classlib -OutputType library
  pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Api" -ProjectType webapi -OutputType app -UpdatePackages
  ```
  Parameters: `-SolutionName` (required), `-ProjectType` (classlib/console/webapi/worker/grpc), `-OutputType` (library/app), `-UpdatePackages` (switch), `-OutputDirectory`

## Constraints
- Use `.slnx` format (XML-based solution, `--format slnx`); avoid legacy `.sln`
- All package versions in `Directory.Packages.props` — never in individual `.csproj` files
- Generated `.csproj` files must not repeat properties already in `Directory.Build.props`
- Solution must build cleanly before task is complete
- Library projects should multi-target; application projects use a single target framework

## Tips
> **Use the `task` tool** for the scaffolding steps — they are mechanical and don't require reasoning. Example: `#task pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Core" -OutputType library -UpdatePackages`
> This allows routing scaffold work to a cheaper, faster model.

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
