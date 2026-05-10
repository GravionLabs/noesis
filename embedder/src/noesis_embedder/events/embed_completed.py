from noesis_embedder.messages.message import Message


class EmbedCompleted(Message):
    job_id: str
    source_id: str | None = None
    chunk_count: int
