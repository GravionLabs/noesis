---
name: dotnet-aspnet-minimal-api-openapi
description: 'Create an ASP.NET Core Minimal API endpoint module using Carter with full OpenAPI documentation, typed request/response models, and proper error responses.'
allowed-tools: read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Create a well-structured ASP.NET Core Minimal API endpoint using Carter with OpenAPI documentation.

## What this skill does
Scaffolds a Carter `ICarterModule` with route handlers, typed request/response models, OpenAPI metadata, and validation — following Minimal API best practices.

## Steps
1. Ask if not provided: route path, HTTP methods, request/response shape, authentication requirements
2. Create or update a Carter module implementing `ICarterModule`:
   ```csharp
   public class <Feature>Module : ICarterModule
   {
       public void AddRoutes(IEndpointRouteBuilder app)
       {
           var group = app.MapGroup("/api/<feature>").WithTags("<Feature>");
           group.MapGet("/", Handle).WithName("<Name>").WithOpenApi();
       }
   }
   ```
3. Add typed request and response record types
4. Add OpenAPI metadata: `.WithSummary()`, `.WithDescription()`, `.Produces<T>()`, `.ProducesProblem()`
5. Register Carter in `Program.cs` if not already: `builder.Services.AddCarter()` + `app.MapCarter()`
6. Add input validation (FluentValidation or Data Annotations)

## Constraints
- Use Carter for organization — not `app.MapGet` scattered in `Program.cs`
- All endpoints must have OpenAPI metadata and typed response types
- Use `TypedResults` (not `Results.Ok(...)`) for compile-time safety

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
