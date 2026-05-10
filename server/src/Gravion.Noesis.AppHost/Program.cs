using Projects;

var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("noesis-postgres-data");

var pgvector = postgres.WithImage("pgvector/pgvector")
    .WithImageTag("pg18");

var db = pgvector.AddDatabase("noesis");

var rabbitmq = builder.AddRabbitMQ("rabbitmq");

var migrator = builder.AddProject<Gravion_Noesis_Migrator>("migrator")
    .WithReference(db)
    .WaitFor(db);

builder.AddProject<Gravion_Noesis_Server>("server")
    .WithReference(db)
    .WithReference(rabbitmq)
    .WaitFor(migrator);

builder.Build().Run();
