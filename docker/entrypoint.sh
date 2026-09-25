#!/bin/sh
set -eu

mkdir -p /data
chown -R app:app /data || true

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/expense-tracker.conf
