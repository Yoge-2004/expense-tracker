# Encrypted production database snapshot

`expense_tracker.sqlite.enc` is generated automatically from the active production database and committed by the backend.

- **Neon PostgreSQL is authoritative while reachable.**
- The snapshot is a SQLite representation encrypted with **AES-256-GCM** before it is committed.
- The encryption password is never stored in this repository.
- When Neon becomes unavailable, the backend hydrates its local emergency datastore from the latest encrypted snapshot and continues serving reads/writes.
- While in emergency mode, the backend periodically commits the updated encrypted snapshot back to this repository.
- Plaintext `*.db`, `*.sqlite`, `*.sqlite3`, and `expenses_sync.json` files are intentionally blocked from being committed.

Required runtime secrets:

- `DB_BACKUP_PASSWORD` — strong encryption password shared by GitHub Actions and the backend.
- `GITHUB_DB_TOKEN` — GitHub token with permission to update this repository's contents from the backend.
- `SYNC_SECRET_KEY` — token used by the scheduled backup workflow to invoke the protected backup endpoint.

Never paste any of these secrets into source code, issues, README files, or commit messages.
