namespace Gravion.Noesis.Core.Settings;

public sealed class DbSettings
{
    public const string SectionName = "DbSettings";

    public string Host { get; init; } = "localhost";
    public int Port { get; init; } = 5432;
    public string DatabaseName { get; init; } = "noesis";
    public string Username { get; init; } = "noesis";
    public string Password { get; init; } = "noesis_dev";

    public string BuildConnectionString() =>
        $"Host={Host};Port={Port};Database={DatabaseName};Username={Username};Password={Password}";
}
