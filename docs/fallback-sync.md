# Emergency fallback and sync-back

The app serves from Neon (primary). If Neon is unreachable (for example its quota is used up) it serves from a local
H2 database (the fallback) and merges whatever was written there back into Neon when Neon returns.

## How it works

| Phase | What happens |
|---|---|
| Neon healthy | Every changed backup export is also loaded into the fallback: tables are created from Neon's metadata, rows are copied, a hash of every row is recorded (the *baseline*), and identity columns restart 1,000,000 above the highest mirrored id. |
| Neon down | Requests are served from the fallback. Nothing is lost: the 10-minute backup exports the fallback (baseline included) to the Hugging Face snapshot. |
| Neon back | The app keeps serving the fallback while a first merge runs. New connections are then held for a moment, a final merge runs, and traffic moves back to Neon. The fallback is re-mirrored straight away. |

A row is merged only if its hash differs from the baseline, so rows the fallback never touched keep whatever Neon has.
Rows created, edited or deleted in the fallback are written to Neon in foreign-key order inside one transaction, with a
savepoint per row. Neon's id sequences are advanced past the merged ids.

If the Space restarts during an outage the baseline comes back with the snapshot, so outage-time writes are still
recognised afterwards. A backup never replaces the snapshot while unmerged fallback writes exist.

## Operating it

- `GET /api/sync/hf-status` has a `fallback` section: `mode` (`PRIMARY`, `FALLBACK`, `RECOVERING`), `pendingFallbackChanges`,
  `lastSync`, `conflictsAwaitingReview`, `lastRecoveryError`.
- `GET /api/health` reports `databaseMode`; while it is not `PRIMARY` the message says the fallback is answering.
- Rows Neon rejected (a unique-key clash, or an id Neon had already used for a different row) are kept in the fallback table
  `fb_conflicts` with the row as JSON. They are reported once and are not retried. Review them and re-enter by hand if needed.
- Log lines to look for: `entering emergency fallback mode`, `merging changes made in the emergency fallback`,
  `Fallback sync finished`, `Fallback sync conflict`.

## Known limits

- For a row changed in the fallback, the fallback version wins. An edit made in Neon to the *same row* in the minutes before the
  outage (after the last mirror) is overwritten.
- The fallback does not enforce unique keys or foreign keys, so clashes surface as conflicts at merge time.
- Tables without a primary key are not synchronised.
- The final merge waits 2 s for in-flight fallback transactions; one that stays open longer could be missed.
- Mirrored tables and columns are upper case, because H2 folds unquoted names to upper case and the app's SQL is unquoted.
