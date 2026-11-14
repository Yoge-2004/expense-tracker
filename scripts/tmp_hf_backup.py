#!/usr/bin/env python3
"""Copies the live ENCRYPTED database snapshot of the Space into a PRIVATE dataset repo, then verifies the copy.
Never writes to the Space. The file stays encrypted (DB_BACKUP_KEY is not needed or touched).
Prints results as annotations; nothing secret or personal is printed."""
import hashlib, os, subprocess, sys, datetime
from huggingface_hub import HfApi, hf_hub_download

SPACE = "Yoge-2004/expense-tracker-backend"
PATH = "database/expense_tracker.sqlite.enc"
BACKUP = os.environ.get("BACKUP_REPO", "Yoge-2004/expense-tracker-db-backup")
token = os.environ["HF_TOKEN"].strip()
api = HfApi(token=token)

def notice(title, body):
    subprocess.run([sys.executable, "scripts/ci_notice.py", title], input=body[:3900], text=True)

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

head = api.repo_info(SPACE, repo_type="space").sha
live = hf_hub_download(SPACE, PATH, repo_type="space", token=token, revision=head, local_dir="live")
size = os.path.getsize(live)
digest = sha256(live)

api.create_repo(BACKUP, repo_type="dataset", private=True, exist_ok=True)
info = api.repo_info(BACKUP, repo_type="dataset")
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
name = f"snapshots/expense_tracker-{stamp}-{digest[:8]}.sqlite.enc"
api.upload_file(path_or_fileobj=live, path_in_repo=name, repo_id=BACKUP, repo_type="dataset",
                commit_message=f"Backup of the live snapshot before deploy (space {head[:8]})")

copy = hf_hub_download(BACKUP, name, repo_type="dataset", token=token, local_dir="verify", force_download=True)
ok = sha256(copy) == digest and os.path.getsize(copy) == size
files = [f for f in api.list_repo_files(BACKUP, repo_type="dataset") if f.startswith("snapshots/")]
notice("hf-backup result", "\n".join([
    f"VERIFIED: {ok}",
    f"source: space {SPACE} @ {head[:12]}  file {PATH}",
    f"size: {size} bytes   sha256: {digest}",
    f"backup repo: {BACKUP} (private={info.private})",
    f"backup file: {name}",
    f"backup repo now holds {len(files)} snapshot file(s)",
]))
sys.exit(0 if ok else 1)
