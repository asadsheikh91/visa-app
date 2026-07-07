#!/bin/bash
set -e

# Run pending migrations before serving traffic. Safe to run on every
# container start — Alembic no-ops if the DB is already at head.
alembic upgrade head

exec "$@"
