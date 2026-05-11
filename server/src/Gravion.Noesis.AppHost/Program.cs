using Projects;

var builder = DistributedApplication.CreateBuilder(args);
var infraMode = (Environment.GetEnvironmentVariable("APPHOST_INFRA_MODE") ?? "external").ToLowerInvariant();
var useManagedInfra = infraMode == "managed";

// Credentials with two infra modes:
// - external: uses docker-compose ports
// - managed: uses dedicated Aspire ports to avoid collisions with compose
const string pgUser = "noesis";
const string pgPassword = "noesis_dev";
const string pgDb = "noesis";
const int composePgHostPort = 5442;
const int composeRmqHostPort = 5682;
const int composeRmqManagementHostPort = 15682;
const int managedPgHostPort = 5542;
const int managedRmqHostPort = 5782;
const int managedRmqManagementHostPort = 16682;
var pgHostPort = useManagedInfra ? managedPgHostPort : composePgHostPort;
var rmqHostPort = useManagedInfra ? managedRmqHostPort : composeRmqHostPort;
var rmqManagementHostPort = useManagedInfra ? managedRmqManagementHostPort : composeRmqManagementHostPort;

// Connection strings for local executables (use localhost + host-mapped ports)
var pgCsServer = $"Host=localhost;Port={pgHostPort};Database={pgDb};Username={pgUser};Password={pgPassword}";
var pgUrlCrawler = $"postgres://{pgUser}:{pgPassword}@localhost:{pgHostPort}/{pgDb}";
var pgUrlEmbedder = $"postgresql://{pgUser}:{pgPassword}@localhost:{pgHostPort}/{pgDb}";
var rmqUrl = $"amqp://guest:guest@localhost:{rmqHostPort}/";

// Python Embedder (uv run uvicorn ...)
var openaiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
var embeddingProvider = Environment.GetEnvironmentVariable("EMBEDDING_PROVIDER") ?? "openai";
var embeddingModel = Environment.GetEnvironmentVariable("EMBEDDING_MODEL") ?? "text-embedding-3-small";
var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_URL") ?? "http://localhost:11434";

if (useManagedInfra)
{
    // Postgres + pgvector — managed by Aspire
    var postgres = builder.AddPostgres("postgres", port: pgHostPort)
        .WithDataVolume("noesis-postgres-data")
        .WithImage("pgvector/pgvector", "pg18")
        .WithEnvironment("POSTGRES_USER", pgUser)
        .WithEnvironment("POSTGRES_PASSWORD", pgPassword)
        .WithEnvironment("POSTGRES_DB", pgDb);

    _ = postgres.AddDatabase(pgDb);

    // RabbitMQ — managed by Aspire
    var rmqUser = builder.AddParameter("rmq-user", "guest", secret: false);
    var rmqPass = builder.AddParameter("rmq-pass", "guest", secret: false);
    var rabbitmq = builder.AddRabbitMQ("rabbitmq", rmqUser, rmqPass, port: rmqHostPort)
        .WithImage("rabbitmq", "management-alpine")
        .WithEndpoint(name: "management", port: rmqManagementHostPort, targetPort: 15672);

    var migrator = builder.AddProject<Gravion_Noesis_Migrator>("migrator")
        .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
        .WaitFor(postgres);

    builder.AddProject<Gravion_Noesis_Server>("server")
        .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
        .WithEnvironment("RabbitMq__Host", "localhost")
        .WithEnvironment("RabbitMq__Port", rmqHostPort.ToString())
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
        .WithEnvironment("EMBEDDING_PROVIDER", embeddingProvider)
        .WithEnvironment("EMBEDDING_MODEL", embeddingModel)
        .WithEnvironment("OPENAI_API_KEY", openaiKey)
        .WithEnvironment("OLLAMA_URL", ollamaUrl)
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
        .WithEnvironment("RabbitMq__Host", "localhost")
        .WithEnvironment("RabbitMq__Port", rmqHostPort.ToString())
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
    .WithEnvironment("EMBEDDING_PROVIDER", embeddingProvider)
    .WithEnvironment("EMBEDDING_MODEL", embeddingModel)
    .WithEnvironment("OPENAI_API_KEY", openaiKey)
    .WithEnvironment("OLLAMA_URL", ollamaUrl)
    .WithHttpEndpoint(port: 8000);
}

builder.Build().Run();
