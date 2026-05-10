using FluentAssertions;

using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.Core.Tests.Entities;

[TestFixture]
public class SourceTests
{
    [Test]
    public void NewSource_HasUniqueId()
    {
        var s1 = new Source();
        var s2 = new Source();

        s1.Id.Should().NotBe(Guid.Empty);
        s1.Id.Should().NotBe(s2.Id);
    }

    [Test]
    public void NewSource_IsEnabledByDefault()
    {
        var source = new Source();
        source.Enabled.Should().BeTrue();
    }

    [Test]
    public void NewSource_HasDefaultImporterType_LlmsTxt()
    {
        var source = new Source();
        source.ImporterType.Should().Be("llmstxt");
    }

    [Test]
    public void NewSource_LastImportedAt_IsNull()
    {
        var source = new Source();
        source.LastImportedAt.Should().BeNull();
    }

    [Test]
    public void NewSource_HasEmptyCollections()
    {
        var source = new Source();
        source.Docs.Should().BeEmpty();
        source.Jobs.Should().BeEmpty();
    }

    [Test]
    public void NewSource_HasCreatedAt_Set()
    {
        var before = DateTime.UtcNow;
        var source = new Source();
        var after = DateTime.UtcNow;

        source.CreatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        source.UpdatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }
}
