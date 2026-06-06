from sqlalchemy import Column, String, DateTime, Integer, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from database import Base


def utc_now_naive() -> datetime:
    """UTC timestamp matching PostgreSQL TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_user_id = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)


class VisaCheck(Base):
    __tablename__ = "visa_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    country              = Column(String,  nullable=False)
    visa_type            = Column(String,  nullable=False)
    score                = Column(Integer, nullable=False)
    result               = Column(String,  nullable=False)
    result_description   = Column(String,  nullable=True)

    # Phase 1 fields — original schema
    critical_blockers    = Column(JSON,    nullable=False, default=list)
    warnings             = Column(JSON,    nullable=False, default=list)
    recommendations      = Column(JSON,    nullable=False, default=list)

    # Phase 4B fields — added by migration 002_add_result_fields
    # nullable=True so existing rows (NULL) are safe; app defaults to [] / {}
    high_risk_flags      = Column(JSON,    nullable=True)
    soft_warnings        = Column(JSON,    nullable=True)
    normalized_answers   = Column(JSON,    nullable=True)
    sources_used         = Column(JSON,    nullable=True)

    created_at           = Column(DateTime, default=utc_now_naive, nullable=False)
