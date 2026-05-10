import json
import logging
from typing import Any

import aio_pika
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class MessageBroker:
    """Encapsulates a RabbitMQ connection using aio-pika."""

    def __init__(self, url: str):
        self._url = url
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None

    async def connect(self) -> None:
        logger.info("Connecting to RabbitMQ at %s", self._url)
        self._connection = await aio_pika.connect_robust(self._url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=1)
        logger.info("RabbitMQ connection established")

    async def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("RabbitMQ connection closed")

    async def get_channel(self) -> aio_pika.abc.AbstractChannel:
        if self._channel is None or self._channel.is_closed:
            await self.connect()
        return self._channel

    async def declare_queue(self, name: str, durable: bool = True) -> aio_pika.abc.AbstractQueue:
        channel = await self.get_channel()
        return await channel.declare_queue(name, durable=durable)

    async def publish(self, queue_name: str, message: Any) -> None:
        """Publish a message to a queue via the default exchange."""
        channel = await self.get_channel()

        if isinstance(message, BaseModel):
            body = message.model_dump_json(by_alias=True).encode()
        elif isinstance(message, (dict, list)):
            body = json.dumps(message).encode()
        else:
            body = str(message).encode()

        await channel.default_exchange.publish(
            aio_pika.Message(
                body=body,
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=queue_name,
        )
        logger.debug("Published message to queue '%s'", queue_name)

    async def consume(self, queue_name: str, callback: Any) -> None:
        """Declare a queue and start consuming with the given callback."""
        channel = await self.get_channel()
        queue = await channel.declare_queue(queue_name, durable=True)
        await queue.consume(callback)
        logger.info("Started consuming from queue '%s'", queue_name)
