from noesis_embedder.messages.message import Message


class StartEmbedJob(Message):
    job_id: str
    source_id: str | None = None
