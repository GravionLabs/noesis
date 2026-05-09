using FluentAssertions;

using Gravion.Contexteur.Core.Models;

namespace Gravion.Contexteur.Core.Tests.Models;

[TestFixture]
public class ImportResultTests
{
    [Test]
    public void ImportResult_WaitForCallback_DefaultsToFalse()
    {
        var result = new ImportResult(true, 1, 5);
        result.WaitForCallback.Should().BeFalse();
    }

    [Test]
    public void ImportResult_Success_StoresAllProperties()
    {
        var result = new ImportResult(true, 3, 12);

        result.Success.Should().BeTrue();
        result.DocCount.Should().Be(3);
        result.ChunkCount.Should().Be(12);
        result.Error.Should().BeNull();
    }

    [Test]
    public void ImportResult_Failure_StoresError()
    {
        var result = new ImportResult(false, 0, 0, "HTTP fetch failed");

        result.Success.Should().BeFalse();
        result.Error.Should().Be("HTTP fetch failed");
    }

    [Test]
    public void ImportResult_WaitForCallback_CanBeSetToTrue()
    {
        var result = new ImportResult(true, 0, 0, WaitForCallback: true);
        result.WaitForCallback.Should().BeTrue();
    }
}

[TestFixture]
public class ImportContextTests
{
    [Test]
    public void ImportContext_StoresJobId()
    {
        var jobId = Guid.NewGuid();
        var context = new ImportContext(jobId);
        context.JobId.Should().Be(jobId);
    }
}
