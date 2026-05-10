---
name: dotnet-mcp-server-generator
description: 'Generate a complete MCP server project in C# with tools, prompts, resources, stdio transport, and proper logging configuration.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Generate a complete Model Context Protocol (MCP) server in C#.

## Stack
- **CLI:** `dotnet` SDK (key commands: `dotnet new console`, `dotnet add package`, `dotnet build`, `dotnet run`)
- **Package manager:** NuGet — `ModelContextProtocol` (prerelease), `Microsoft.Extensions.Hosting`
Creates a C# console application that implements an MCP server using `ModelContextProtocol` (prerelease) with `Microsoft.Extensions.Hosting`, exposes tools and prompts, and uses stdio transport.

## Steps
1. Ask: project name, tools to expose (names, descriptions, input schemas), prompts to include
2. Create project:
   ```bash
   dotnet new console -n <ProjectName>
   cd <ProjectName>
   dotnet add package ModelContextProtocol --prerelease
   dotnet add package Microsoft.Extensions.Hosting
   ```
3. Configure `Program.cs`:
   ```csharp
   var builder = Host.CreateApplicationBuilder(args);
   builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace);
   builder.Services.AddMcpServer()
       .WithStdioServerTransport()
       .WithTools<MyTools>()
       .WithPrompts<MyPrompts>();
   await builder.Build().RunAsync();
   ```
4. Create tool classes with `[McpServerToolType]` and `[McpServerTool]` attributes
5. Create prompt classes with `[McpServerPromptType]` and `[McpServerPrompt]` attributes
6. Add `appsettings.json` with `Logging` config routing all logs to stderr
7. Build and verify: `dotnet build`

## Templates
Starter files are available in `templates/` alongside this skill:
- **`Program.cs`** — host setup with `AddMcpServer()`, stdio transport, tool and prompt registration
- **`Tools.cs`** — `[McpServerToolType]` class with two example tools (sync + async with `CancellationToken`)
- **`Prompts.cs`** — `[McpServerPromptType]` class with an example `PromptMessage` return

## Constraints
- All logs must go to stderr — never stdout (stdio transport uses stdout for MCP protocol)
- Tool methods should be `async Task<string>` or `async Task<CallToolResponse>`

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
