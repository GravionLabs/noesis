using FluentAssertions;

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

        job1.Id.Should().NotBe(Guid.Empty);
        job1.Id.Should().NotBe(job2.Id);
    }

    [Test]
    public void NewJob_HasDefaultStatus_Pending()
    {
        var job = new Job();
        job.Status.Should().Be("pending");
    }

    [Test]
    public void NewJob_HasDefaultType_Crawl()
    {
        var job = new Job();
        job.Type.Should().Be("crawl");
    }

    [Test]
    public void NewJob_HasCreatedAt_Set()
    {
        var before = DateTime.UtcNow;
        var job = new Job();
        var after = DateTime.UtcNow;

        job.CreatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Test]
    public void NewJob_StartedAt_AndFinishedAt_AreNull()
    {
        var job = new Job();
        job.StartedAt.Should().BeNull();
        job.FinishedAt.Should().BeNull();
    }

    [Test]
    public void NewJob_Error_IsNull()
    {
        var job = new Job();
        job.Error.Should().BeNull();
    }
}
