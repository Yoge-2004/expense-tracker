#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8080}"

find_backend_pids() {
    ps -eo pid=,args= | awk '
        /com\.example\.expensetracker\.ExpenseTrackerSystemApplication/ ||
        /spring-boot:run/ { print $1 }
    ' | while read -r pid; do
        [[ "$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)" == "$ROOT_DIR" ]] && echo "$pid"
    done
    true
}

stop_existing_backend() {
    local pids
    pids="$(find_backend_pids)"
    [[ -z "$pids" ]] && return

    echo "Stopping existing backend process(es): $(tr '\n' ' ' <<< "$pids")"
    while read -r pid; do
        [[ -z "$pid" ]] || kill "$pid" 2>/dev/null || true
    done <<< "$pids"

    for _ in {1..20}; do
        sleep 0.5
        [[ -z "$(find_backend_pids)" ]] && return
    done

    while read -r pid; do
        [[ -z "$pid" ]] || kill -KILL "$pid" 2>/dev/null || true
    done <<< "$(find_backend_pids)"
}

stop_existing_backend

export JWT_SECRET="$(openssl rand -hex 32)"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:63342,http://127.0.0.1:63342}"
export SERVER_PORT="$BACKEND_PORT"

echo "Starting backend on http://localhost:${BACKEND_PORT}"
echo "CORS allowed origins: ${CORS_ALLOWED_ORIGINS}"
cd "$ROOT_DIR"
exec "$ROOT_DIR/mvnw" spring-boot:run
