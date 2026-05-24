using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Infrastructure.Importers;

using NSubstitute;

namespace Gravion.Noesis.Infrastructure.Tests.Importers;

[TestFixture]
public class ImporterRegistryTests
{
    private static IImporter MakeImporter(string type)
    {
        var importer = Substitute.For<IImporter>();
        importer.ImporterType.Returns(type);
        return importer;
    }

    [Test]
    public void GetImporter_ReturnsCorrectImporter_ForRegisteredType()
    {
        var llmsTxt = MakeImporter("llmstxt");
        var registry = new ImporterRegistry([llmsTxt]);

        var result = registry.GetImporter("llmstxt");

        result.ShouldBeSameAs(llmsTxt);
    }

    [Test]
    public void GetImporter_IsCaseInsensitive()
    {
        var llmsTxt = MakeImporter("llmstxt");
        var registry = new ImporterRegistry([llmsTxt]);

        registry.GetImporter("LLMSTXT").ShouldBeSameAs(llmsTxt);
        registry.GetImporter("LlmsTxt").ShouldBeSameAs(llmsTxt);
    }

    [Test]
    public void GetImporter_ThrowsInvalidOperationException_ForUnknownType()
    {
        var registry = new ImporterRegistry([MakeImporter("llmstxt")]);

        var act = () => registry.GetImporter("github");

        Should.Throw<InvalidOperationException>(() => act()).Message.ShouldContain("github");
    }

    [Test]
    public void RegisteredTypes_ContainsAllRegisteredImporterTypes()
    {
        var registry = new ImporterRegistry([
            MakeImporter("llmstxt"),
            MakeImporter("crawler"),
            MakeImporter("github")
        ]);

        registry.RegisteredTypes.OrderBy(x => x).ToList().ShouldBe(new[] { "crawler", "github", "llmstxt" });
    }

    [Test]
    public void GetImporter_ErrorMessage_ListsAvailableTypes()
    {
        var registry = new ImporterRegistry([MakeImporter("llmstxt"), MakeImporter("crawler")]);

        var act = () => registry.GetImporter("unknown");

        var exception = Should.Throw<InvalidOperationException>(() => act());
        exception.Message.ShouldContain("llmstxt");
        exception.Message.ShouldContain("crawler");
    }
}
