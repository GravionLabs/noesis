using Gravion.Noesis.Infrastructure.Data;
using Gravion.Noesis.Core.Settings;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Gravion.Noesis.Infrastructure;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("CONNECTIONSTRINGS__NOESIS");
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            var connectionOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connectionString, o => o.UseVector())
                .Options;

            return new AppDbContext(connectionOptions);
        }

        var dbSettings = new DbSettings
        {
            Host = Environment.GetEnvironmentVariable("DBSETTINGS__HOST") ?? "localhost",
            Port = int.TryParse(Environment.GetEnvironmentVariable("DBSETTINGS__PORT"), out var port) ? port : 5442,
            DatabaseName = Environment.GetEnvironmentVariable("DBSETTINGS__DATABASENAME") ?? "noesis",
            Username = Environment.GetEnvironmentVariable("DBSETTINGS__USERNAME") ?? "noesis",
            Password = Environment.GetEnvironmentVariable("DBSETTINGS__PASSWORD") ?? "noesis_dev"
        };

        var settingsOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(dbSettings.BuildConnectionString(), o => o.UseVector())
            .Options;

        return new AppDbContext(settingsOptions);
    }
}
