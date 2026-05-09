using System.ComponentModel;
using Contexteur.Core.Entities;
using Contexteur.UseCases.Chunks.GetChunk;
using Contexteur.UseCases.Search.SearchDocs;
using Contexteur.UseCases.Sources.ListSources;
using ModelContextProtocol.Server;
using Wolverine;
using GetChunkResult = Contexteur.UseCases.Chunks.GetChunk.ChunkResult;

namespace Contexteur.Server.Tools;

[McpServerToolType]
public class ContextTools(IMessageBus bus)
{
    [McpServerTool]
    [Description("Search documentation using semantic similarity. Returns relevant text chunks.")]
    public async Task<string> search_docs(
        [Description("The search query")] string query,
        [Description("Maximum number of results to return (default: 5)")]
        int limit = 5,
        [Description("Optional: filter by source name")]
        string? source = null)
    {
        var result = await bus.InvokeAsync<SearchDocsResult>(new SearchDocsQuery(query, limit, source));
        if (result.Chunks.Count == 0)
            return "No results found.";
        return string.Join("\n\n---\n\n", result.Chunks.Select(c =>
            $"**Source:** {c.SourceName}\n**URL:** {c.DocUrl}\n**Heading:** {c.Heading ?? "(none)"}\n\n{c.Content}"));
    }

    [McpServerTool]
    [Description("Retrieve a specific chunk by its ID.")]
    public async Task<string> retrieve_context(
        [Description("The chunk UUID to retrieve")]
        string chunkId)
    {
        if (!Guid.TryParse(chunkId, out var id))
            return "Invalid chunk ID format.";

        var chunk = await bus.InvokeAsync<GetChunkResult?>(new GetChunkQuery(id));
        if (chunk is null)
            return $"Chunk {id} not found.";

        return
            $"**Source:** {chunk.SourceName}\n**URL:** {chunk.DocUrl}\n**Heading:** {chunk.Heading ?? "(none)"}\n\n{chunk.Content}";
    }

    [McpServerTool]
    [Description("List all registered documentation sources.")]
    public async Task<string> list_sources()
    {
        var sources = await bus.InvokeAsync<List<Source>>(new ListSourcesQuery());
        if (sources.Count == 0)
            return "No sources registered yet. Use the API to add sources.";
        return string.Join("\n", sources.Select(s =>
            $"- **{s.Name}** ({s.ImporterType}) — {s.Url}{(s.Enabled ? "" : " [disabled]")}"));
    }
}