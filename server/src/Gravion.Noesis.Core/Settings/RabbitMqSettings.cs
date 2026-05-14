namespace Gravion.Noesis.Core.Settings;

public sealed class RabbitMqSettings
{
    public const string SectionName = "RabbitMqSettings";

    public string Host { get; init; } = "localhost";
    public int Port { get; init; } = 5672;
    public string Username { get; init; } = "guest";
    public string Password { get; init; } = "guest";
    public string VirtualHost { get; init; } = "/";
    public int ManagementPort { get; init; } = 15672;
}
