import logging
import os
import platform
import sys
import threading
from logging import INFO, StreamHandler, getLogger
from typing import Any

import structlog
from structlog import BoundLogger
from structlog.typing import EventDict

from noesis_embedder import env as cloud
from noesis_embedder.env import Environment, get_version

LEVEL_OVERRIDES: dict[str, int] = {
    "uvicorn": logging.INFO,
    "uvicorn.error": logging.INFO,
    "uvicorn.access": logging.WARNING,
    "httpx": logging.WARNING,
    "httpcore": logging.WARNING,
    "asyncio": logging.WARNING,
    "aio_pika": logging.WARNING,
    "pika": logging.WARNING,
    "kombu": logging.WARNING,
    "aiormq": logging.WARNING,
    "amqp": logging.WARNING,
}


class _NamespaceFilter(logging.Filter):
    def __init__(self, overrides: dict[str, int] | None = None, default_min_level: int = logging.DEBUG) -> None:
        super().__init__()
        self._overrides = sorted((overrides or LEVEL_OVERRIDES).items(), key=lambda item: len(item[0]), reverse=True)
        self._default_min_level = default_min_level

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        for prefix, min_level in self._overrides:
            if record.name == prefix or record.name.startswith(prefix + "."):
                return record.levelno >= min_level
        return record.levelno >= self._default_min_level


def drop_color_message_key(_, __, event_dict: EventDict) -> EventDict:
    event_dict.pop("color_message", None)
    return event_dict


def pop_message_field(_, __, event_dict: EventDict) -> EventDict:
    message = event_dict.pop("message", None)
    if message and "event" not in event_dict:
        event_dict["event"] = message
    return event_dict


def rename_event_to_message(_, __, event_dict: EventDict) -> EventDict:
    event = event_dict.pop("event", None)
    if event is not None:
        event_dict["message"] = event
    return event_dict


def add_cloud_environment(_, __, event_dict: EventDict) -> EventDict:
    labels: dict[str, Any] = event_dict.get("labels") or {}
    labels.setdefault("EnvironmentName", str(Environment.current()))
    labels.setdefault("Topic", cloud.topic())
    for key in cloud.ENVIRONMENT_KEYS:
        value = cloud.get_env(key)
        if value:
            labels.setdefault(key, value)
    event_dict["labels"] = labels
    return event_dict


def add_ecs_error_fields(_, __, event_dict: EventDict) -> EventDict:
    exc_info = event_dict.get("exc_info")
    if isinstance(exc_info, BaseException):
        event_dict.setdefault("error.type", type(exc_info).__name__)
        event_dict.setdefault("error.message", str(exc_info))
    return event_dict


def _extract_from_record(_, __, event_dict: EventDict) -> EventDict:
    record = event_dict.get("_record")
    if record is None:
        return event_dict

    if "log.logger" not in event_dict:
        event_dict["log.logger"] = record.name
    event_dict.setdefault("process.pid", record.process)
    event_dict.setdefault("process.thread.id", record.thread)
    return event_dict


def add_ecs_metadata(_, __, event_dict: EventDict) -> EventDict:
    event_dict.setdefault("ecs.version", "8.11.0")
    event_dict.setdefault("service.name", "noesis-embedder")
    event_dict.setdefault("service.environment", str(Environment.current()))
    event_dict.setdefault("service.version", get_version())
    event_dict.setdefault("host.name", platform.node())
    event_dict.setdefault("process.pid", os.getpid())
    event_dict.setdefault("process.thread.id", threading.get_ident())
    event_dict.setdefault("process.executable", sys.executable)

    container_name = cloud.container_metadata_name()
    if container_name:
        event_dict.setdefault("container.name", container_name)
    namespace = cloud.container_metadata_namespace()
    if namespace:
        event_dict.setdefault("orchestrator.namespace", namespace)
    node = cloud.container_metadata_node()
    if node:
        event_dict.setdefault("host.hostname", node)
    node_ip = cloud.container_metadata_node_ip()
    if node_ip:
        event_dict.setdefault("host.ip", node_ip)
    aws_region = cloud.get_env(cloud.AWS_REGION_KEY)
    if aws_region:
        event_dict.setdefault("cloud.region", aws_region)
    return event_dict


def log_exception(
    logger: BoundLogger,
    exc: BaseException,
    message: str,
    *,
    level: str = "error",
    **kwargs: Any,
) -> None:
    level_lower = level.lower()
    valid_levels = {"debug", "info", "warning", "error", "critical"}
    log_fn = getattr(logger, level_lower) if level_lower in valid_levels else logger.error
    log_fn(
        message,
        exc_info=exc,
        error={
            "type": type(exc).__name__,
            "message": str(exc),
        },
        **kwargs,
    )


def configure_logger(
    *,
    default_level: int = INFO,
    level_overrides: dict[str, int] | None = None,
    enable_json_logs: bool = True,
) -> None:
    # Always structured output (JSON), even in development.
    _ = enable_json_logs
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.stdlib.ExtraAdder(),
        drop_color_message_key,
        pop_message_field,
        add_ecs_error_fields,
        _extract_from_record,
        add_ecs_metadata,
        add_cloud_environment,
        structlog.processors.TimeStamper(fmt="iso"),
        rename_event_to_message,
    ]

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )

    handler = StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(_NamespaceFilter(level_overrides or LEVEL_OVERRIDES, default_level))

    root_logger = getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(default_level)

    for namespace, level in (level_overrides or LEVEL_OVERRIDES).items():
        ns_logger = getLogger(namespace)
        ns_logger.setLevel(level)
        ns_logger.propagate = True
        ns_logger.handlers.clear()

    structlog.configure(
        processors=shared_processors + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        wrapper_class=structlog.make_filtering_bound_logger(default_level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def setup_logging(default_level: int = INFO, enable_json_logs: bool = True) -> BoundLogger:
    configure_logger(default_level=default_level, enable_json_logs=enable_json_logs)
    return structlog.get_logger("noesis")


def bind_contextvars(event_metadata: dict[str, Any]) -> None:
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(**event_metadata)


def get_logger(name: str | None = None) -> BoundLogger:
    return structlog.get_logger(name or "noesis")


def log_service_startup(app_name: str, version: str, logger: BoundLogger | None = None) -> None:
    logger = logger or structlog.get_logger("noesis.service")
    logger.info(
        "service_startup",
        service_name=app_name,
        service_version=version,
        environment=str(Environment.current()),
        running_in_container=cloud.is_running_in_container(),
        topic=cloud.topic(),
    )
