using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.Core.Tests.Entities;

[TestFixture]
public class JobTests
{
    [Test]
    public void NewJob_HasUniqueId()
    {
        var job1 = new Job();
        var job2 = new Job();

        job1.Id.ShouldNotBe(Guid.Empty);
        job1.Id.ShouldNotBe(job2.Id);
    }

    [Test]
    public void NewJob_HasDefaultStatus_Pending()
    {
        var job = new Job();
        job.Status.ShouldBe("pending");
    }

    [Test]
    public void NewJob_HasDefaultType_Crawl()
    {
        var job = new Job();
        job.Type.ShouldBe("crawl");
    }

    [Test]
    public void NewJob_HasCreatedAt_Set()
    {
        var before = DateTime.UtcNow;
        var job = new Job();
        var after = DateTime.UtcNow;

        job.CreatedAt.ShouldBeGreaterThanOrEqualTo(before);
        job.CreatedAt.ShouldBeLessThanOrEqualTo(after);
    }

    [Test]
    public void NewJob_StartedAt_AndFinishedAt_AreNull()
    {
        var job = new Job();
        job.StartedAt.ShouldBeNull();
        job.FinishedAt.ShouldBeNull();
    }

    [Test]
    public void NewJob_Error_IsNull()
    {
        var job = new Job();
        job.Error.ShouldBeNull();
    }
}
