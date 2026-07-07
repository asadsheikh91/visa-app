"""
services/report_storage.py

Private R2 storage for generated report PDFs (constraint #7): the bucket is private,
and downloads are handed out only as short-lived, signed (presigned) GET URLs. The
object key is namespaced by the report's unguessable token, so keys aren't
enumerable either.

Reuses the same S3-compatible (boto3) access pattern as services/visa_data_service,
but with its own key prefix (R2_REPORTS_PREFIX). If R2 isn't configured, the /pdf
route degrades to 503 (same posture as the rest of the app).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

_REQUIRED_R2_ENV = ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
_BOTO_CONFIG = BotoConfig(
    connect_timeout=5,
    read_timeout=15,
    retries={"max_attempts": 2, "mode": "standard"},
)
_DEFAULT_URL_TTL = 300  # 5 minutes


class ReportStorageError(Exception):
    """R2 is unconfigured/unreachable or an upload/sign failed → surface as 503."""


def is_configured() -> bool:
    return all(os.environ.get(n) for n in _REQUIRED_R2_ENV)


def _client() -> Any:
    missing = [n for n in _REQUIRED_R2_ENV if not os.environ.get(n)]
    if missing:
        raise ReportStorageError(f"R2 is not configured (missing {', '.join(missing)}).")
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=_BOTO_CONFIG,
    )


def _bucket() -> str:
    # Reports may live in the same bucket as visa data (private) or a dedicated one.
    return os.environ.get("R2_REPORTS_BUCKET") or os.environ.get("R2_BUCKET_NAME", "visa-app")


def _prefix() -> str:
    return os.environ.get("R2_REPORTS_PREFIX", "parchivisa-reports")


def object_key(report_token: str, report_id: str) -> str:
    """Key namespaced by the unguessable token → not enumerable from the report id."""
    return f"{_prefix()}/{report_token}/{report_id}.pdf"


def upload_pdf(key: str, data: bytes) -> None:
    client = _client()
    try:
        client.put_object(
            Bucket=_bucket(),
            Key=key,
            Body=data,
            ContentType="application/pdf",
            CacheControl="private, no-store",
        )
    except (BotoCoreError, ClientError) as exc:
        logger.warning("Report PDF upload failed (%s).", type(exc).__name__)
        raise ReportStorageError("Failed to store the report PDF.") from exc


def presigned_get_url(key: str, ttl_seconds: int = _DEFAULT_URL_TTL) -> str:
    client = _client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=ttl_seconds,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.warning("Report PDF presign failed (%s).", type(exc).__name__)
        raise ReportStorageError("Failed to sign the report download URL.") from exc
