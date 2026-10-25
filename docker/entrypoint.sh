#!/bin/sh
set -eu

mkdir -p /data/cache/huggingface
# Avoid blocking recursive chown on large model directories during boot
if [ "$(id -u)" = "0" ]; then
    chown app:app /data /data/cache /data/cache/huggingface 2>/dev/null || true
fi

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/expense-tracker.conf
