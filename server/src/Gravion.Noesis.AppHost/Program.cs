using Projects;

var builder = DistributedApplication.CreateBuilder(args);

// Fixed credentials and ports
const string pgUser = "noesis";
const string pgPassword = "noesis_dev";
const int pgPort = 5442;
const int rmqPort = 5682;

// Create parameters for Postgres credentials
var pgUserParam = builder.AddParameter("pg-user", pgUser, secret: false);
var pgPasswordParam = builder.AddParameter("pg-password", pgPassword, secret: true);

// Postgres + pgvector on fixed port 5442
var postgres = builder.AddPostgres("postgres", pgUserParam, pgPasswordParam, port: pgPort)
    .WithDataVolume("noesis-postgres-data")
    .WithImage("pgvector/pgvector")
    .WithImageTag("pg18");

var db = postgres.AddDatabase("noesis");

// RabbitMQ on fixed port 5682
var rabbitmq = builder.AddRabbitMQ("rabbitmq", port: rmqPort);

// Migrator
var migrator = builder.AddProject<Gravion_Noesis_Migrator>("migrator")
    .WithReference(db)
    .WaitFor(db);

// .NET Server
builder.AddProject<Gravion_Noesis_Server>("server")
    .WithReference(db)
    .WithReference(rabbitmq)
    .WaitFor(migrator);

// Node.js Crawler (dev: npm run dev)
builder.AddExecutable("crawler", "npm", args: ["run", "dev"], workingDirectory: "../../../crawler")
    .WithEnvironment("DATABASE_URL", $"postgres://{pgUser}:{pgPassword}@postgres:5432/noesis")
    .WithEnvironment("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
    .WithEnvironment("PORT", "3001")
    .WithHttpEndpoint(port: 3001, targetPort: 3001)
    .WithReference(postgres)
    .WithReference(rabbitmq)
    .WaitFor(postgres)
    .WaitFor(rabbitmq);

// Python Embedder (dev: uv run uvicorn ...)
var openaiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
builder.AddExecutable("embedder", "uv", args: ["run", "uvicorn", "noesis_embedder.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], workingDirectory: "../../../embedder")
    .WithEnvironment("DATABASE_URL", $"postgresql://{pgUser}:{pgPassword}@postgres:5432/noesis")
    .WithEnvironment("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
    .WithEnvironment("EMBEDDING_PROVIDER", "openai")
    .WithEnvironment("OPENAI_API_KEY", openaiKey)
    .WithHttpEndpoint(port: 8000, targetPort: 8000)
    .WithReference(postgres)
    .WithReference(rabbitmq)
    .WaitFor(postgres)
    .WaitFor(rabbitmq);

builder.Build().Run();
