import inspect
import json
import logging

from pydantic import BaseModel

from noesis_embedder.messages.broker import MessageBroker
from noesis_embedder.messages.registry import Consumer

logger = logging.getLogger(__name__)


async def setup_consumers(broker: MessageBroker, consumer: Consumer) -> None:
    """Register all decorated consumer functions with the message broker."""
    logger.info("Setting up %d RabbitMQ consumers", len(consumer.consumers))

    for definition in consumer.consumers:
        def make_callback(defn):
            async def callback(message: object) -> None:
                async with message.process():
                    try:
                        payload = json.loads(message.body.decode())

                        if defn.event_type and issubclass(defn.event_type, BaseModel):
                            data = defn.event_type.model_validate(payload)
                        else:
                            data = payload

                        if inspect.iscoroutinefunction(defn.func):
                            await defn.func(data)
                        else:
                            defn.func(data)
                    except Exception:
                        logger.exception("Error processing message from queue '%s'", defn.queue_name)
                        raise

            return callback

        await broker.consume(queue_name=definition.queue_name, callback=make_callback(definition))
        logger.debug("Registered consumer for queue '%s'", definition.queue_name)
