#!/bin/sh
set -eu

# Une seule instance applique les migrations avant de servir l'API.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  alembic upgrade head
fi

exec "$@"
