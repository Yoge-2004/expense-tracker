# Encrypted production database snapshot

`expense_tracker.sqlite.enc` is the recovery snapshot for the production database. It is stored in the **Hugging Face Space repository**, not in the GitHub source repository.

## Architecture

- **Neon PostgreSQL is authoritative while reachable.**
- The active database is exported to a portable SQLite snapshot every 10 minutes.
- The SQLite snapshot is encrypted with **AES-256-GCM** and committed as `database/expense_tracker.sqlite.enc` in the Hugging Face Space repository.
- The repository may be public, but the database contents are not readable without the single `DB_BACKUP_KEY` secret.
- If Neon becomes unavailable, the backend hydrates its local failover datastore from the latest encrypted HF snapshot and continues serving reads and writes.
- During failover, the updated failover state is periodically encrypted and pushed back to the HF Space repository.
- This is snapshot-based disaster recovery, not a live database replica; the recovery point is limited by the snapshot interval.

## Required runtime secrets

Only these two runtime secrets are required for the HF database backup/failover path:

- `HF_TOKEN` — a Hugging Face token with permission to read and update the Space repository.
- `DB_BACKUP_KEY` — the single secret used to encrypt and decrypt the database snapshot.

No second database password is required.

## Security rules

- Never commit `DB_BACKUP_KEY` or `HF_TOKEN` to source control.
- Never commit plaintext `*.db`, `*.sqlite`, `*.sqlite3`, or `expenses_sync.json` database exports.
- Keep `database/expense_tracker.sqlite.enc` encrypted at all times.
- If the backup key is exposed, rotate it and create a fresh encrypted snapshot.

The encrypted snapshot is intentionally stored in the Hugging Face Space repository because that repository is the requested recovery storage location. The backend uses the decrypted snapshot only as temporary input while hydrating the local failover datastore; plaintext database files are not committed.

## Is it working?

The first snapshot is taken right after the application starts, then every 10 minutes, and only uploaded when the data changed. If `database/expense_tracker.sqlite.enc` is missing from the repository, check in this order:

1. **Runtime secrets on the Space** (Settings → Variables and secrets): `HF_TOKEN` with *write* access and `DB_BACKUP_KEY`. Without either, backups never run. The GitHub Actions `HF_TOKEN` secret only deploys the Space and does not count.
2. **Status endpoint:** `GET /api/sync/hf-status` with header `X-Sync-Token: <SYNC_SECRET_KEY>`. It reports which settings are present, the token's scope, `lastAttemptAt`, `lastSuccessAt`, `lastUploadAt` and `lastError`. It never returns a secret.
3. **Force a backup now:** `POST /api/sync/push-to-hf` with the same header. The response includes the same diagnostics.
4. **Startup log:** the Space logs `HF database failover is disabled` (naming the missing settings) or `Encrypted database snapshot pushed`.

An export with 0 rows is never uploaded, so a fresh or unreachable database cannot overwrite a good snapshot.

### Where the snapshot lives

By default it is committed to the Space repository (`HF_REPO_TYPE=space`). Hugging Face rebuilds a Space on every commit to its repository, so snapshot commits can restart the Space. To avoid that, set `HF_REPO_TYPE=dataset` and `HF_SPACE_REPO` to a dataset name such as `Yoge-2004/expense-tracker-data`: it is created as a **private** dataset on first backup (the token needs permission to create repositories, otherwise create it by hand) and the snapshot is restored from there on startup.

