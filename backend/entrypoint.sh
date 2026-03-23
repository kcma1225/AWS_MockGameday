#!/bin/sh
set -eu

: "${SHARED_FOLDERS_DIR:?SHARED_FOLDERS_DIR is required}"

mkdir -p "$SHARED_FOLDERS_DIR"
chmod -R u+rwX "$SHARED_FOLDERS_DIR"

exec "$@"
