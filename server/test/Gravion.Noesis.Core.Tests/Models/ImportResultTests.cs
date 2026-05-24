using Gravion.Noesis.Core.Models;

namespace Gravion.Noesis.Core.Tests.Models;

[TestFixture]
public class ImportResultTests
{
    [Test]
    public void ImportResult_WaitForCallback_DefaultsToFalse()
    {
        var result = new ImportResult(true, 1, 5);
        result.WaitForCallback.ShouldBeFalse();
    }

    [Test]
    public void ImportResult_Success_StoresAllProperties()
    {
        var result = new ImportResult(true, 3, 12);

        result.Success.ShouldBeTrue();
        result.DocCount.ShouldBe(3);
        result.ChunkCount.ShouldBe(12);
        result.Error.ShouldBeNull();
    }

    [Test]
    public void ImportResult_Failure_StoresError()
    {
        var result = new ImportResult(false, 0, 0, "HTTP fetch failed");

        result.Success.ShouldBeFalse();
        result.Error.ShouldBe("HTTP fetch failed");
    }

    [Test]
    public void ImportResult_WaitForCallback_CanBeSetToTrue()
    {
        var result = new ImportResult(true, 0, 0, WaitForCallback: true);
        result.WaitForCallback.ShouldBeTrue();
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
        context.JobId.ShouldBe(jobId);
    }
}
