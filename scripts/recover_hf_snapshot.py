#!/usr/bin/env python3
"""Find and restore an earlier version of the encrypted database snapshot in the Hugging Face Space.

The snapshot (database/expense_tracker.sqlite.enc) is overwritten by every backup, and the deploy
compacts the Space's git history, so an earlier version can only be reached through the Space's
stored LFS files. This lists every stored version of that file and can download one and put it back.

Needs:  pip install huggingface_hub requests      and a token with WRITE access in HF_TOKEN.
The token is read from the environment and never printed. Nothing here needs DB_BACKUP_KEY: the file
stays encrypted the whole time.

  export HF_TOKEN=hf_...
  python scripts/recover_hf_snapshot.py list
  python scripts/recover_hf_snapshot.py download --oid <sha256> --out recovered.sqlite.enc
  python scripts/recover_hf_snapshot.py restore  --file recovered.sqlite.enc

IMPORTANT: pause the Space (Settings -> Pause) before `restore`, then start it again afterwards.
While it runs, the app's own backup job can overwrite the file you just restored.
"""
import argparse
import hashlib
import os
import sys

import requests
from huggingface_hub import HfApi

REPO = os.environ.get("HF_SPACE_REPO", "Yoge-2004/expense-tracker-backend")
REPO_TYPE = os.environ.get("HF_REPO_TYPE", "space")
PATH = os.environ.get("HF_DB_PATH", "database/expense_tracker.sqlite.enc")


def token() -> str:
    value = os.environ.get("HF_TOKEN", "").strip()
    if not value:
        sys.exit("Set HF_TOKEN (a Hugging Face token with write access) first.")
    return value


def human(size: int) -> str:
    return f"{size / 1024:.1f} KB" if size < 1024 * 1024 else f"{size / 1024 / 1024:.1f} MB"


def cmd_list(api: HfApi) -> None:
    files = [f for f in api.list_lfs_files(REPO, repo_type=REPO_TYPE) if f.filename == PATH]
    files.sort(key=lambda f: str(f.pushed_at or ''))
    if not files:
        print(f"No stored LFS versions of {PATH} found.")
    for f in files:
        print(f"{str(f.pushed_at)[:19]}  {human(f.size):>10}  oid={f.file_oid}  ref={f.ref or '(no longer referenced)'}")
    print("\nCommits that still exist:")
    for c in list(api.list_repo_commits(REPO, repo_type=REPO_TYPE))[:15]:
        print(f"  {c.created_at:%Y-%m-%d %H:%M}  {c.commit_id[:8]}  {c.title[:70]}")


def cmd_download(api: HfApi, oid: str, out: str) -> None:
    match = [f for f in api.list_lfs_files(REPO, repo_type=REPO_TYPE) if f.file_oid == oid]
    if not match:
        sys.exit("That oid is not a stored LFS file of this Space. Run `list` first.")
    size = match[0].size
    prefix = "spaces/" if REPO_TYPE == "space" else ("datasets/" if REPO_TYPE == "dataset" else "")
    url = f"https://huggingface.co/{prefix}{REPO}.git/info/lfs/objects/batch"
    headers = {
        "Authorization": f"Bearer {token()}",
        "Accept": "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
    }
    body = {"operation": "download", "transfers": ["basic"], "hash_algo": "sha256",
            "objects": [{"oid": oid, "size": size}]}
    reply = requests.post(url, headers=headers, json=body, timeout=60)
    reply.raise_for_status()
    actions = reply.json()["objects"][0].get("actions", {}).get("download")
    if not actions:
        sys.exit("Hugging Face did not offer a download for that object (it may have been deleted).")
    data = requests.get(actions["href"], headers=actions.get("header", {}), timeout=300)
    data.raise_for_status()
    digest = hashlib.sha256(data.content).hexdigest()
    if digest != oid:
        sys.exit(f"Checksum mismatch (got {digest}); not writing the file.")
    with open(out, "wb") as handle:
        handle.write(data.content)
    print(f"Saved {out} ({human(len(data.content))}), checksum verified.")


def cmd_restore(api: HfApi, file: str) -> None:
    size = os.path.getsize(file)
    print(f"About to REPLACE {PATH} in {REPO} with {file} ({human(size)}).")
    print("The Space must be paused so the app does not overwrite it again.")
    if input("Type RESTORE to continue: ").strip() != "RESTORE":
        sys.exit("Cancelled.")
    api.upload_file(path_or_fileobj=file, path_in_repo=PATH, repo_id=REPO, repo_type=REPO_TYPE,
                    commit_message="Restore database snapshot from an earlier version")
    print("Restored. Now start the Space again.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    d = sub.add_parser("download")
    d.add_argument("--oid", required=True)
    d.add_argument("--out", required=True)
    r = sub.add_parser("restore")
    r.add_argument("--file", required=True)
    args = parser.parse_args()
    api = HfApi(token=token())
    if args.command == "list":
        cmd_list(api)
    elif args.command == "download":
        cmd_download(api, args.oid, args.out)
    else:
        cmd_restore(api, args.file)


if __name__ == "__main__":
    main()
