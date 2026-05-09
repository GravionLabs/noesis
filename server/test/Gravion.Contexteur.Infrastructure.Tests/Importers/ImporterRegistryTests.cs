using FluentAssertions;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Infrastructure.Importers;

using NSubstitute;

namespace Gravion.Contexteur.Infrastructure.Tests.Importers;

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

        result.Should().BeSameAs(llmsTxt);
    }

    [Test]
    public void GetImporter_IsCaseInsensitive()
    {
        var llmsTxt = MakeImporter("llmstxt");
        var registry = new ImporterRegistry([llmsTxt]);

        registry.GetImporter("LLMSTXT").Should().BeSameAs(llmsTxt);
        registry.GetImporter("LlmsTxt").Should().BeSameAs(llmsTxt);
    }

    [Test]
    public void GetImporter_ThrowsInvalidOperationException_ForUnknownType()
    {
        var registry = new ImporterRegistry([MakeImporter("llmstxt")]);

        var act = () => registry.GetImporter("github");

        act.Should()
            .Throw<InvalidOperationException>()
            .WithMessage("*github*");
    }

    [Test]
    public void RegisteredTypes_ContainsAllRegisteredImporterTypes()
    {
        var registry = new ImporterRegistry([
            MakeImporter("llmstxt"),
            MakeImporter("crawler"),
            MakeImporter("github")
        ]);

        registry.RegisteredTypes.Should().BeEquivalentTo("llmstxt", "crawler", "github");
    }

    [Test]
    public void GetImporter_ErrorMessage_ListsAvailableTypes()
    {
        var registry = new ImporterRegistry([MakeImporter("llmstxt"), MakeImporter("crawler")]);

        var act = () => registry.GetImporter("unknown");

        var exception = act.Should().Throw<InvalidOperationException>().Which;
        exception.Message.Should().Contain("llmstxt");
        exception.Message.Should().Contain("crawler");
    }
}
