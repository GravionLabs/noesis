FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /repo

COPY Directory.Build.props .
COPY Directory.Packages.props .
COPY src/Directory.Build.props src/

COPY src/Gravion.Noesis.Migrator/Gravion.Noesis.Migrator.csproj src/Gravion.Noesis.Migrator/
COPY src/Gravion.Noesis.Infrastructure/Gravion.Noesis.Infrastructure.csproj src/Gravion.Noesis.Infrastructure/
COPY src/Gravion.Noesis.Core/Gravion.Noesis.Core.csproj src/Gravion.Noesis.Core/
COPY src/Gravion.Noesis.UseCases/Gravion.Noesis.UseCases.csproj src/Gravion.Noesis.UseCases/
RUN dotnet restore src/Gravion.Noesis.Migrator/Gravion.Noesis.Migrator.csproj

COPY src/ src/
RUN dotnet publish src/Gravion.Noesis.Migrator/Gravion.Noesis.Migrator.csproj \
    -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Gravion.Noesis.Migrator.dll", "--migrate"]
