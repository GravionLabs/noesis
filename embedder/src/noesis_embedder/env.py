import importlib.metadata
import os
import pathlib
import tomllib
from enum import StrEnum

AWS_REGION_KEY = "AWS_REGION"
CLOUD_ENVIRONMENT_KEY = "CLOUD_ENVIRONMENT"
CLUSTER_KEY = "CLUSTER"
CONTAINER_ALB_HOSTNAME_KEY = "CONTAINER_ALB_HOSTNAME"
CONTAINER_METADATA_DEPLOYMENT_SERVICENAME_KEY = "CONTAINER_METADATA_DEPLOYMENT_SERVICENAME"
CONTAINER_METADATA_IMAGE_NAME_KEY = "CONTAINER_METADATA_IMAGE_NAME"
CONTAINER_METADATA_JOB_NAME_KEY = "CONTAINER_METADATA_JOB_NAME"
CONTAINER_METADATA_NAMESPACE_KEY = "CONTAINER_METADATA_NAMESPACE"
CONTAINER_METADATA_NAME_KEY = "CONTAINER_METADATA_NAME"
CONTAINER_METADATA_NODE_IP_KEY = "CONTAINER_METADATA_NODE_IP"
CONTAINER_METADATA_NODE_KEY = "CONTAINER_METADATA_NODE"
CONTAINER_METADATA_POD_IP_KEY = "CONTAINER_METADATA_POD_IP"
CONTAINER_METADATA_POD_PORT_KEY = "CONTAINER_METADATA_POD_PORT"
CONTAINER_METADATA_SERVICE_ACCOUNT_KEY = "CONTAINER_METADATA_SERVICE_ACCOUNT"
DOTNET_ENVIRONMENT_KEY = "DOTNET_ENVIRONMENT"
PYTHON_ENVIRONMENT_KEY = "PYTHON_ENVIRONMENT"
RUNNING_IN_CONTAINER_KEY = "RUNNING_IN_CONTAINER"
SETTINGS_PATH_KEY = "SETTINGS_PATH"
TOPIC_KEY = "TOPIC"

ENVIRONMENT_KEYS = {
    AWS_REGION_KEY,
    CLOUD_ENVIRONMENT_KEY,
    CLUSTER_KEY,
    CONTAINER_ALB_HOSTNAME_KEY,
    CONTAINER_METADATA_DEPLOYMENT_SERVICENAME_KEY,
    CONTAINER_METADATA_IMAGE_NAME_KEY,
    CONTAINER_METADATA_JOB_NAME_KEY,
    CONTAINER_METADATA_NAMESPACE_KEY,
    CONTAINER_METADATA_NAME_KEY,
    CONTAINER_METADATA_NODE_IP_KEY,
    CONTAINER_METADATA_NODE_KEY,
    CONTAINER_METADATA_POD_IP_KEY,
    CONTAINER_METADATA_POD_PORT_KEY,
    CONTAINER_METADATA_SERVICE_ACCOUNT_KEY,
    DOTNET_ENVIRONMENT_KEY,
    PYTHON_ENVIRONMENT_KEY,
    RUNNING_IN_CONTAINER_KEY,
    SETTINGS_PATH_KEY,
    TOPIC_KEY,
}


def get_env(key: str) -> str:
    return os.environ.get(key, "")


def container_metadata_name() -> str:
    return get_env(CONTAINER_METADATA_NAME_KEY)


def container_metadata_job_name() -> str:
    return get_env(CONTAINER_METADATA_JOB_NAME_KEY)


def container_metadata_namespace() -> str:
    return get_env(CONTAINER_METADATA_NAMESPACE_KEY)


def container_metadata_node() -> str:
    return get_env(CONTAINER_METADATA_NODE_KEY)


def container_metadata_node_ip() -> str:
    return get_env(CONTAINER_METADATA_NODE_IP_KEY)


def container_metadata_service_account() -> str:
    return get_env(CONTAINER_METADATA_SERVICE_ACCOUNT_KEY)


def is_running_in_container() -> bool:
    return get_env(RUNNING_IN_CONTAINER_KEY).lower() == "true"


def get_settings_path() -> str:
    return os.environ.get(SETTINGS_PATH_KEY, "/app/settings")


def topic() -> str:
    return os.environ.get(TOPIC_KEY, "common")


def get_version(source_file: str | None = None) -> str:
    """Get version from pyproject first, then installed package metadata."""
    source_location = pathlib.Path(source_file or __file__).resolve().parent.parent
    pyproject = source_location.parent / "pyproject.toml"
    if not pyproject.exists():
        pyproject = source_location.parent.parent / "pyproject.toml"

    if pyproject.exists():
        with open(pyproject, "rb") as f:
            return tomllib.load(f)["project"]["version"]

    try:
        return importlib.metadata.version("noesis-embedder")
    except importlib.metadata.PackageNotFoundError:
        return "0.0.0"


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"

    @classmethod
    def current(cls) -> "Environment":
        return cls.from_value(os.environ.get(PYTHON_ENVIRONMENT_KEY, cls.DEVELOPMENT))

    @staticmethod
    def from_value(value: str) -> "Environment":
        try:
            return Environment(value.lower())
        except ValueError:
            return Environment.DEVELOPMENT
