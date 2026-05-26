namespace Gravion.Noesis.Core.Settings;

public sealed class McpSettings
{
    public const string SectionName = "Mcp";

    public string[] InspectorAllowedOrigins { get; init; } =
    [
        "http://localhost:6274",
        "http://127.0.0.1:6274"
    ];
}
