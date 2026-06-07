# Data Model

## Entities

### Source
- `Id`
- `Name`
- `Url`
- `ImporterType`
- `Enabled`
- `Config`
- `Schedule`
- `LastImportedAt`
- `CreatedAt`
- `UpdatedAt`

### Doc
- `Id`
- `SourceId`
- `Url`
- `Title`
- `ContentMd`
- `ContentHash`
- `IndexedAt`
- `CreatedAt`
- `UpdatedAt`

### Chunk
- `Id`
- `DocId`
- `SourceId`
- `Content`
- `Heading`
- `HeadingPath`
- `ChunkIndex`
- `TokenCount`
- `CreatedAt`

### Embedding
- `Id`
- `ChunkId`
- `Model`
- `Dimensions`
- `Vector`
- `CreatedAt`

### Job
- `Id`
- `Type`
- `SourceId`
- `Status`
- `Error`
- `StartedAt`
- `FinishedAt`
- `CreatedAt`

### ImportJobState
- `CorrelationId`
- `CurrentState`
- `JobId`
- `SourceId`
- `ImporterType`
- `DocCount`
- `ChunkCount`
- `StartedAt`

## Persistence rules
- Postgres `vector` extension is required.
- `Source.Url` is unique.
- `Doc` is unique per `(SourceId, Url)`.
- `Embedding` is unique per `(ChunkId, Model)`.
- `ImportJobState.JobId` is unique.
