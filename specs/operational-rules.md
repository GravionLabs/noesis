# Operational Rules

## Canonical rules
- `specs/` is the source of truth for behavior and contracts.
- `docs/` is supporting narrative only.
- MCP tooling is read-only for content access.

## Validation
- Source creation validates required fields.
- Import triggers require a valid source ID.
- Search requires a non-empty query.
- Chunk retrieval requires a valid GUID.

## Error handling
- Missing entities return `404`-style responses.
- Unique source URL violations are surfaced as conflicts.
- Internal callbacks only publish events; they do not silently swallow failures.

## Maintenance rules
- Keep spec files aligned with code contracts.
- Update the spec collection before changing behavior in code.
