using Projects;

var builder = DistributedApplication.CreateBuilder(args);

// Credentials and ports matching infra/docker-compose.yml exactly
const string pgUser = "noesis";
const string pgPassword = "noesis_dev";
const string pgDb = "noesis";
const int pgHostPort = 5442;
const int rmqHostPort = 5682;
const int rmqManagementHostPort = 15682;

// Connection strings for local executables (use localhost + host-mapped ports)
string pgCsServer = $"Host=localhost;Port={pgHostPort};Database={pgDb};Username={pgUser};Password={pgPassword}";
string pgUrlCrawler = $"postgres://{pgUser}:{pgPassword}@localhost:{pgHostPort}/{pgDb}";
string pgUrlEmbedder = $"postgresql://{pgUser}:{pgPassword}@localhost:{pgHostPort}/{pgDb}";
string rmqUrl = $"amqp://guest:guest@localhost:{rmqHostPort}/";

// Postgres + pgvector — credentials set via env (no AddParameter)
var postgres = builder.AddPostgres("postgres", port: pgHostPort)
    .WithDataVolume("noesis-postgres-data")
    .WithImage("pgvector/pgvector", "pg18")
    .WithEnvironment("POSTGRES_USER", pgUser)
    .WithEnvironment("POSTGRES_PASSWORD", pgPassword)
    .WithEnvironment("POSTGRES_DB", pgDb);

var db = postgres.AddDatabase(pgDb);

// RabbitMQ — management-alpine image, guest:guest, management UI on 15682
var rabbitmq = builder.AddRabbitMQ("rabbitmq", port: rmqHostPort)
    .WithImage("rabbitmq", "management-alpine")
    .WithEnvironment("RABBITMQ_DEFAULT_USER", "guest")
    .WithEnvironment("RABBITMQ_DEFAULT_PASS", "guest")
    .WithManagementPlugin(port: rmqManagementHostPort);

// Migrator
var migrator = builder.AddProject<Gravion_Noesis_Migrator>("migrator")
    .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
    .WaitFor(postgres);

// .NET Server — connection string + RabbitMQ host injected via env
builder.AddProject<Gravion_Noesis_Server>("server")
    .WithEnvironment("ConnectionStrings__noesis", pgCsServer)
    .WithEnvironment("RabbitMq__Host", "localhost")
    .WithEnvironment("RabbitMq__Port", rmqHostPort.ToString())
    .WaitFor(migrator)
    .WaitFor(rabbitmq);

// Node.js Crawler (npm run dev)
builder.AddExecutable("crawler", "npm", workingDirectory: "../../../crawler", args: ["run", "dev"])
    .WithEnvironment("DATABASE_URL", pgUrlCrawler)
    .WithEnvironment("RABBITMQ_URL", rmqUrl)
    .WithEnvironment("PORT", "3001")
    .WithHttpEndpoint(port: 3001, targetPort: 3001)
    .WaitFor(postgres)
    .WaitFor(rabbitmq);

// Python Embedder (uv run uvicorn ...)
var openaiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
var embeddingProvider = Environment.GetEnvironmentVariable("EMBEDDING_PROVIDER") ?? "openai";
var embeddingModel = Environment.GetEnvironmentVariable("EMBEDDING_MODEL") ?? "text-embedding-3-small";
var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_URL") ?? "http://localhost:11434";

builder.AddExecutable("embedder", "uv", workingDirectory: "../../../embedder",
        args: ["run", "uvicorn", "noesis_embedder.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"])
    .WithEnvironment("DATABASE_URL", pgUrlEmbedder)
    .WithEnvironment("RABBITMQ_URL", rmqUrl)
    .WithEnvironment("EMBEDDING_PROVIDER", embeddingProvider)
    .WithEnvironment("EMBEDDING_MODEL", embeddingModel)
    .WithEnvironment("OPENAI_API_KEY", openaiKey)
    .WithEnvironment("OLLAMA_URL", ollamaUrl)
    .WithHttpEndpoint(port: 8000, targetPort: 8000)
    .WaitFor(postgres)
    .WaitFor(rabbitmq);

builder.Build().Run();
