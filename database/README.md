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