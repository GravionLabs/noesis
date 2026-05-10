import inspect
from dataclasses import dataclass, field
from typing import Callable, Type, get_type_hints, List


@dataclass
class ConsumerDefinition:
    queue_name: str
    func: Callable
    event_type: Type | None = None


class Consumer:
    def __init__(self):
        self.consumers: List[ConsumerDefinition] = []

    def subscribe(self, queue_name: str):
        """Decorator to register a handler for a RabbitMQ queue."""
        if not queue_name:
            raise ValueError("queue_name cannot be empty")

        def decorator(func: Callable):
            type_hints = get_type_hints(func)
            params = list(inspect.signature(func).parameters.values())
            event_type = type_hints.get(params[0].name) if params else None
            self.consumers.append(ConsumerDefinition(queue_name=queue_name, func=func, event_type=event_type))
            return func

        return decorator

    def include(self, other: "Consumer"):
        """Merge consumers from another Consumer instance."""
        self.consumers.extend(other.consumers)
