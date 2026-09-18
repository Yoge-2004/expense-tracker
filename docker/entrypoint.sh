#!/bin/sh
set -eu

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/expense-tracker.conf
