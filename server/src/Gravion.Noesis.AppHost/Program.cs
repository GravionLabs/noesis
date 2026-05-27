using Projects;
using Gravion.Noesis.Core.Settings;
using Microsoft.Extensions.Configuration;

var builder = DistributedApplication.CreateBuilder(args);
var infraMode = (Environment.GetEnvironmentVariable("APPHOST_INFRA_MODE") ?? "external").ToLowerInvariant();
var useManagedInfra = infraMode == "managed";

var dbSettings = builder.Configuration.GetSection(DbSettings.SectionName).Get<DbSettings>() ?? new DbSettings();
var rabbitMqSettings = builder.Configuration.GetSection(RabbitMqSettings.SectionName).Get<RabbitMqSettings>() ?? new RabbitMqSettings();
var servicesSettings = builder.Configuration.GetSection(ServicesSettings.SectionName).Get<ServicesSettings>() ?? new ServicesSettings();
var ollamaSettings = builder.Configuration.GetSection(OllamaSettings.SectionName).Get<OllamaSettings>() ?? new OllamaSettings();

// Credentials with two infra modes:
// - external: uses docker-compose ports
// - managed: uses dedicated Aspire ports to avoid collisions with compose
const int managedPgHostPort = 5542;
const int managedRmqHostPort = 5782;
const int managedRmqManagementHostPort = 16682;
var pgHostPort = useManagedInfra ? managedPgHostPort : dbSettings.Port;
var rmqHostPort = useManagedInfra ? managedRmqHostPort : rabbitMqSettings.Port;
var rmqManagementHostPort = useManagedInfra ? managedRmqManagementHostPort : rabbitMqSettings.ManagementPort;

// Connection strings for local executables (use localhost + host-mapped ports)
var pgSettings = new DbSettings
{
    Host = "localhost",
    Port = pgHostPort,
    DatabaseName = dbSettings.DatabaseName,
    Username = dbSettings.Username,
    Password = dbSettings.Password
};
var rmqSettings = new RabbitMqSettings
{
    Host = "localhost",
    Port = rmqHostPort,
    Username = rabbitMqSettings.Username,
    Password = rabbitMqSettings.Password,
    VirtualHost = rabbitMqSettings.VirtualHost,
    ManagementPort = rmqManagementHostPort
};
var services = new ServicesSettings
{
    CrawlerUrl = servicesSettings.CrawlerUrl,
    EmbedderUrl = servicesSettings.EmbedderUrl
};
var ollama = new OllamaSettings
{
    Url = ollamaSettings.Url,
    EmbeddingProvider = ollamaSettings.EmbeddingProvider,
    EmbeddingModel = ollamaSettings.EmbeddingModel
};

var pgCsServer = pgSettings.BuildConnectionString();
var pgUrlCrawler = $"postgres://{pgSettings.Username}:{pgSettings.Password}@localhost:{pgHostPort}/{pgSettings.DatabaseName}";
var pgUrlEmbedder = $"postgresql://{pgSettings.Username}:{pgSettings.Password}@localhost:{pgHostPort}/{pgSettings.DatabaseName}";
var rmqUrl = $"amqp://{rmqSettings.Username}:{rmqSettings.Password}@localhost:{rmqHostPort}/";

if (useManagedInfra)
{
    // Postgres + pgvector — managed by Aspire
    var postgres = builder.AddPostgres("postgres", port: pgHostPort)
        .WithDataVolume("noesis-postgres-data")
        .WithImage("pgvector/pgvector", "pg18")
        .WithEnvironment("POSTGRES_USER", dbSettings.Username)
        .WithEnvironment("POSTGRES_PASSWORD", dbSettings.Password)
        .WithEnvironment("POSTGRES_DB", dbSettings.DatabaseName);

    _ = postgres.AddDatabase(dbSettings.DatabaseName);

    // RabbitMQ — managed by Aspire
    var rmqUser = builder.AddParameter("rmq-user", rabbitMqSettings.Username, secret: false);
    var rmqPass = builder.AddParameter("rmq-pass", rabbitMqSettings.Password, secret: false);
    var rabbitmq = builder.AddRabbitMQ("rabbitmq", rmqUser, rmqPass, port: rmqHostPort)
        .WithImage("rabbitmq", "management-alpine")
        .WithEndpoint(name: "management", port: rmqManagementHostPort, targetPort: 15672);

    var migrator = builder.AddProject<Gravion_Noesis_Migrator>("migrator")
        .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
        .WaitFor(postgres);

    builder.AddProject<Gravion_Noesis_Server>("server")
        .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
        .WithEnvironment("DbSettings__Host", pgSettings.Host)
        .WithEnvironment("DbSettings__Port", pgSettings.Port.ToString())
        .WithEnvironment("DbSettings__DatabaseName", pgSettings.DatabaseName)
        .WithEnvironment("DbSettings__Username", pgSettings.Username)
        .WithEnvironment("DbSettings__Password", pgSettings.Password)
        .WithEnvironment("RabbitMqSettings__Host", rmqSettings.Host)
        .WithEnvironment("RabbitMqSettings__Port", rmqSettings.Port.ToString())
        .WithEnvironment("RabbitMqSettings__Username", rmqSettings.Username)
        .WithEnvironment("RabbitMqSettings__Password", rmqSettings.Password)
        .WithEnvironment("RabbitMqSettings__ManagementPort", rmqSettings.ManagementPort.ToString())
        .WithEnvironment("Services__CrawlerUrl", services.CrawlerUrl)
        .WithEnvironment("Services__EmbedderUrl", services.EmbedderUrl)
        .WaitFor(migrator)
        .WaitFor(rabbitmq);

    builder.AddExecutable("crawler", "npm", "../../../crawler", "run", "dev")
        .WithEnvironment("DATABASE_URL", pgUrlCrawler)
        .WithEnvironment("RABBITMQ_URL", rmqUrl)
        .WithEnvironment("PORT", "3001")
        .WithHttpEndpoint(port: 3001)
        .WaitFor(postgres)
        .WaitFor(rabbitmq);

    builder.AddExecutable("embedder",
            "uv",
            "../../../embedder",
            "run",
            "uvicorn",
            "noesis_embedder.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--reload")
        .WithEnvironment("DATABASE_URL", pgUrlEmbedder)
        .WithEnvironment("RABBITMQ_URL", rmqUrl)
        .WithEnvironment("EMBEDDING_PROVIDER", ollama.EmbeddingProvider)
        .WithEnvironment("EMBEDDING_MODEL", ollama.EmbeddingModel)
        .WithEnvironment("OLLAMA_URL", ollama.Url)
        .WithHttpEndpoint(port: 8000)
        .WaitFor(postgres)
        .WaitFor(rabbitmq);
}
else
{
    // External mode: use existing infra on docker-compose ports, do not start competing DB/MQ resources.
    var migrator = builder.AddProject<Gravion_Noesis_Migrator>("migrator")
        .WithEnvironment("ConnectionStrings__noesis", pgCsServer);

    builder.AddProject<Gravion_Noesis_Server>("server")
        .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
        .WithEnvironment("DbSettings__Host", pgSettings.Host)
        .WithEnvironment("DbSettings__Port", pgSettings.Port.ToString())
        .WithEnvironment("DbSettings__DatabaseName", pgSettings.DatabaseName)
        .WithEnvironment("DbSettings__Username", pgSettings.Username)
        .WithEnvironment("DbSettings__Password", pgSettings.Password)
        .WithEnvironment("RabbitMqSettings__Host", rmqSettings.Host)
        .WithEnvironment("RabbitMqSettings__Port", rmqSettings.Port.ToString())
        .WithEnvironment("RabbitMqSettings__Username", rmqSettings.Username)
        .WithEnvironment("RabbitMqSettings__Password", rmqSettings.Password)
        .WithEnvironment("RabbitMqSettings__ManagementPort", rmqSettings.ManagementPort.ToString())
        .WithEnvironment("Services__CrawlerUrl", services.CrawlerUrl)
        .WithEnvironment("Services__EmbedderUrl", services.EmbedderUrl)
        .WaitFor(migrator);

    builder.AddExecutable("crawler", "npm", "../../../crawler", "run", "dev")
        .WithEnvironment("DATABASE_URL", pgUrlCrawler)
        .WithEnvironment("RABBITMQ_URL", rmqUrl)
        .WithEnvironment("PORT", "3001")
        .WithHttpEndpoint(port: 3001);

    builder.AddExecutable("embedder",
        "uv",
        "../../../embedder",
        "run",
        "uvicorn",
        "noesis_embedder.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload")
    .WithEnvironment("DATABASE_URL", pgUrlEmbedder)
    .WithEnvironment("RABBITMQ_URL", rmqUrl)
    .WithEnvironment("EMBEDDING_PROVIDER", ollama.EmbeddingProvider)
    .WithEnvironment("EMBEDDING_MODEL", ollama.EmbeddingModel)
    .WithEnvironment("OLLAMA_URL", ollama.Url)
    .WithHttpEndpoint(port: 8000);
}

builder.Build().Run();
