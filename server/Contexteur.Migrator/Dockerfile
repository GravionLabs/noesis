FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Contexteur.Server/Contexteur.Server.csproj Contexteur.Server/
COPY Contexteur.Migrator/Contexteur.Migrator.csproj Contexteur.Migrator/
RUN dotnet restore Contexteur.Migrator/Contexteur.Migrator.csproj

COPY . .
RUN dotnet publish Contexteur.Migrator/Contexteur.Migrator.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Contexteur.Migrator.dll", "--migrate"]
