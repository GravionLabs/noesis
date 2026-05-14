using System.ComponentModel;

using Ardalis.Result;

using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Chunks.GetChunk;
using Gravion.Noesis.UseCases.Search.SearchDocs;
using Gravion.Noesis.UseCases.Sources.ListSources;

using ModelContextProtocol.Server;

using GetChunkResult = Gravion.Noesis.UseCases.Chunks.GetChunk.ChunkResult;

namespace Gravion.Noesis.Server.Tools;

[McpServerToolType]
public class ContextTools(SearchDocsHandler searchHandler, GetChunkHandler getChunkHandler, ListSourcesHandler listSourcesHandler)
{
    [McpServerTool(Name = "search_docs", ReadOnly = true, Idempotent = true)]
    [Description("Search documentation using semantic similarity. Returns relevant text chunks.")]
    public async Task<string> SearchDocsAsync(
        [Description("The search query")] string query,
        [Description("Maximum number of results to return (default: 5)")]
        int limit = 5,
        [Description("Optional: filter by source name")]
        string? source = null)
    {
        var result = await searchHandler.Handle(new SearchDocsQuery(query, limit, source), CancellationToken.None);
        if (!result.IsSuccess)
            return "Search failed.";
        if (result.Value.Chunks.Count == 0)
            return "No results found.";
        return string.Join("\n\n---\n\n",
            result.Value.Chunks.Select(c =>
                $"**Source:** {c.SourceName}\n**URL:** {c.DocUrl}\n**Heading:** {c.Heading ?? "(none)"}\n\n{c.Content}"));
    }

    [McpServerTool(Name = "get_chunk", ReadOnly = true, Idempotent = true)]
    [Description("Retrieve a specific documentation chunk by its ID.")]
    public async Task<string> RetrieveContextAsync(
        [Description("The chunk UUID to retrieve")]
        string chunkId)
    {
        if (!Guid.TryParse(chunkId, out var id))
            return "Invalid chunk ID format.";

        var result = await getChunkHandler.Handle(new GetChunkQuery(id), CancellationToken.None);
        if (result.Status == ResultStatus.NotFound)
            return $"Chunk {id} not found.";

        var chunk = result.Value;
        return
            $"**Source:** {chunk.SourceName}\n**URL:** {chunk.DocUrl}\n**Heading:** {chunk.Heading ?? "(none)"}\n\n{chunk.Content}";
    }

    [McpServerTool(Name = "list_sources", ReadOnly = true, Idempotent = true)]
    [Description("List all registered documentation sources.")]
    public async Task<string> ListSourcesAsync()
    {
        var result = await listSourcesHandler.Handle(new ListSourcesQuery(), CancellationToken.None);
        if (!result.IsSuccess || result.Value.Count == 0)
            return "No sources registered yet. Use the API to add sources.";
        return string.Join("\n",
            result.Value.Select(s =>
                $"- **{s.Name}** ({s.ImporterType}) — {s.Url}{(s.Enabled ? "" : " [disabled]")}"));
    }
}
