FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Gravion.Noesis.Server/Gravion.Noesis.Server.csproj Gravion.Noesis.Server/
COPY Gravion.Noesis.Migrator/Gravion.Noesis.Migrator.csproj Gravion.Noesis.Migrator/
RUN dotnet restore Gravion.Noesis.Migrator/Gravion.Noesis.Migrator.csproj

COPY . .
RUN dotnet publish Gravion.Noesis.Migrator/Gravion.Noesis.Migrator.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Gravion.Noesis.Migrator.dll", "--migrate"]
