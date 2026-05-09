FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Gravion.Contexteur.Server/Gravion.Contexteur.Server.csproj Gravion.Contexteur.Server/
COPY Gravion.Contexteur.Migrator/Gravion.Contexteur.Migrator.csproj Gravion.Contexteur.Migrator/
RUN dotnet restore Gravion.Contexteur.Migrator/Gravion.Contexteur.Migrator.csproj

COPY . .
RUN dotnet publish Gravion.Contexteur.Migrator/Gravion.Contexteur.Migrator.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Gravion.Contexteur.Migrator.dll", "--migrate"]
