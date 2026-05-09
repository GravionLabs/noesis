using Projects;

var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("contexteur-postgres-data");

var pgvector = postgres.WithImage("pgvector/pgvector")
    .WithImageTag("pg18");

var db = pgvector.AddDatabase("contexteur");

var rabbitmq = builder.AddRabbitMQ("rabbitmq");

var migrator = builder.AddProject<Gravion_Contexteur_Migrator>("migrator")
    .WithReference(db)
    .WaitFor(db);

builder.AddProject<Gravion_Contexteur_Server>("server")
    .WithReference(db)
    .WithReference(rabbitmq)
    .WaitFor(migrator);

builder.Build().Run();
