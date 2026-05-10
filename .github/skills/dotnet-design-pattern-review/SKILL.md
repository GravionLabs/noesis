---
name: dotnet-design-pattern-review
description: 'Review C#/.NET code for design pattern implementation quality and suggest improvements. Read-only — outputs findings, does not modify code.'
allowed-tools: read search codebase
model: claude-sonnet-4.6
---

Review C#/.NET code for design pattern implementation and suggest improvements.

## What this skill does
Identifies design patterns in use (or that should be used), evaluates their implementation quality, and suggests concrete improvements. Does not modify code.

## Patterns to evaluate

### Creational
- **Factory / Abstract Factory**: Is object creation logic properly encapsulated?
- **Builder**: Are complex objects built with a clear, fluent API?
- **Singleton**: Is it implemented via DI (preferred) rather than static instances?

### Structural
- **Decorator**: Are cross-cutting concerns (logging, caching, validation) applied via decoration rather than inheritance?
- **Adapter / Facade**: Are third-party or legacy integrations properly abstracted?
- **Composite**: Are tree structures handled uniformly?

### Behavioural
- **Strategy**: Are interchangeable algorithms behind interfaces?
- **Observer / Event**: Are events used appropriately vs. tight coupling?
- **Mediator (MediatR)**: Is CQRS/mediator applied where request handling complexity warrants it?
- **Repository**: Are data access concerns abstracted from business logic?

## Output format
For each finding:
- **Pattern**: name and location
- **Issue**: what is wrong or missing
- **Recommendation**: specific, actionable improvement with a code sketch if helpful

Do not recommend patterns where they add unnecessary complexity.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
