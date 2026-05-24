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

        s1.Id.ShouldNotBe(Guid.Empty);
        s1.Id.ShouldNotBe(s2.Id);
    }

    [Test]
    public void NewSource_IsEnabledByDefault()
    {
        var source = new Source();
        source.Enabled.ShouldBeTrue();
    }

    [Test]
    public void NewSource_HasDefaultImporterType_LlmsTxt()
    {
        var source = new Source();
        source.ImporterType.ShouldBe("llmstxt");
    }

    [Test]
    public void NewSource_LastImportedAt_IsNull()
    {
        var source = new Source();
        source.LastImportedAt.ShouldBeNull();
    }

    [Test]
    public void NewSource_HasEmptyCollections()
    {
        var source = new Source();
        source.Docs.ShouldBeEmpty();
        source.Jobs.ShouldBeEmpty();
    }

    [Test]
    public void NewSource_HasCreatedAt_Set()
    {
        var before = DateTime.UtcNow;
        var source = new Source();
        var after = DateTime.UtcNow;

        source.CreatedAt.ShouldBeGreaterThanOrEqualTo(before);
        source.CreatedAt.ShouldBeLessThanOrEqualTo(after);
        source.UpdatedAt.ShouldBeGreaterThanOrEqualTo(before);
        source.UpdatedAt.ShouldBeLessThanOrEqualTo(after);
    }
}
