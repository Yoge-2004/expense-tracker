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
  python scripts/recover_hf_snapshot.py cleanup            # delete the database/backups/ folder
  python scripts/recover_hf_snapshot.py restore-oid --oid <sha256> [--target owner/repo] [--yes]
  python scripts/recover_hf_snapshot.py pause | resume     # pause / restart the Space itself

--yes skips the typed confirmation (used by the GitHub workflow). HF_TARGET_REPO / --target restore into
a different repository than the one the snapshot is read from (for example a private dataset repo).

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
    """Compact summary: GitHub annotations are cut at 4096 characters."""
    files = [f for f in api.list_lfs_files(REPO, repo_type=REPO_TYPE) if f.filename == PATH]
    files.sort(key=lambda f: str(f.pushed_at or ""))
    if not files:
        print(f"No stored LFS versions of {PATH} found.")
    else:
        sizes = {}
        for f in files:
            sizes.setdefault(human(f.size), []).append(f)
        print(f"{len(files)} stored versions of {PATH}, {str(files[0].pushed_at)[:19]} .. {str(files[-1].pushed_at)[:19]}")
        for label, group in sorted(sizes.items(), key=lambda kv: -max(x.size for x in kv[1])):
            first, last = group[0], group[-1]
            print(f"  {label:>10} x{len(group):<3} {str(first.pushed_at)[:16]} .. {str(last.pushed_at)[:16]}  "
                  f"oldest oid={first.file_oid}  newest oid={last.file_oid}")
        unreferenced = [f for f in files if not f.ref]
        print(f"  not referenced by any commit: {len(unreferenced)}")
    commits = list(api.list_repo_commits(REPO, repo_type=REPO_TYPE))
    print(f"\n{len(commits)} commits in the Space; oldest {commits[-1].created_at:%Y-%m-%d %H:%M} "
          f"'{commits[-1].title[:50]}', newest {commits[0].created_at:%Y-%m-%d %H:%M}")
    for c in commits[:6]:
        print(f"  {c.created_at:%m-%d %H:%M}  {c.commit_id[:8]}  {c.title[:60]}")
    others = {}
    for f in api.list_lfs_files(REPO, repo_type=REPO_TYPE):
        if f.filename != PATH:
            others.setdefault(f.filename.split("/")[0], [0, 0])
            others[f.filename.split("/")[0]][0] += 1
            others[f.filename.split("/")[0]][1] += f.size
    print("\nOther stored LFS files by top folder: " + ", ".join(f"{k}: {v[0]} files {human(v[1])}" for k, v in others.items()))


def fetch_lfs(api: HfApi, oid: str) -> bytes:
    """Download one stored LFS object by checksum and verify it."""
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
        sys.exit(f"Checksum mismatch (got {digest}); not using the file.")
    return data.content


def cmd_download(api: HfApi, oid: str, out: str) -> None:
    content = fetch_lfs(api, oid)
    with open(out, "wb") as handle:
        handle.write(content)
    print(f"Saved {out} ({human(len(content))}), checksum verified.")


def confirm(word: str, yes: bool) -> None:
    if yes:
        return
    if input(f"Type {word} to continue: ").strip() != word:
        sys.exit("Cancelled.")


def cmd_restore(api: HfApi, file: str, yes: bool = False, target: str | None = None) -> None:
    size = os.path.getsize(file)
    repo = target or REPO
    print(f"About to REPLACE {PATH} in {repo} with {file} ({human(size)}).")
    print("The Space must be paused so the app does not overwrite it again.")
    confirm("RESTORE", yes)
    api.upload_file(path_or_fileobj=file, path_in_repo=PATH, repo_id=repo, repo_type=os.environ.get("HF_TARGET_REPO_TYPE") or REPO_TYPE,
                    commit_message="Restore database snapshot from an earlier version")
    print("Restored. Now start the Space again.")


def cmd_restore_oid(api: HfApi, oid: str, yes: bool, target: str | None) -> None:
    content = fetch_lfs(api, oid)
    path = "restored.sqlite.enc"
    with open(path, "wb") as handle:
        handle.write(content)
    print(f"Fetched {human(len(content))}, checksum verified.")
    cmd_restore(api, path, yes, target)


def cmd_cleanup(api: HfApi, yes: bool = False) -> None:
    folder = PATH.rsplit("/", 1)[0] + "/backups" if "/" in PATH else "backups"
    print(f"About to DELETE the folder {folder}/ from {REPO} (extra snapshot copies, not the live snapshot).")
    confirm("DELETE", yes)
    api.delete_folder(path_in_repo=folder, repo_id=REPO, repo_type=REPO_TYPE,
                      commit_message="Remove extra snapshot copies")
    print("Deleted.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    d = sub.add_parser("download")
    d.add_argument("--oid", required=True)
    d.add_argument("--out", required=True)
    r = sub.add_parser("restore")
    r.add_argument("--file", required=True)
    r.add_argument("--yes", action="store_true")
    r.add_argument("--target", default=os.environ.get("HF_TARGET_REPO") or None)
    ro = sub.add_parser("restore-oid")
    ro.add_argument("--oid", required=True)
    ro.add_argument("--yes", action="store_true")
    ro.add_argument("--target", default=os.environ.get("HF_TARGET_REPO") or None)
    c = sub.add_parser("cleanup")
    c.add_argument("--yes", action="store_true")
    sub.add_parser("pause")
    sub.add_parser("resume")
    args = parser.parse_args()
    api = HfApi(token=token())
    if args.command == "list":
        cmd_list(api)
    elif args.command == "download":
        cmd_download(api, args.oid, args.out)
    elif args.command == "cleanup":
        cmd_cleanup(api, args.yes)
    elif args.command == "restore-oid":
        cmd_restore_oid(api, args.oid, args.yes, args.target)
    elif args.command == "pause":
        api.pause_space(REPO)
        print(f"Paused {REPO}.")
    elif args.command == "resume":
        api.restart_space(REPO)
        print(f"Restart requested for {REPO}.")
    else:
        cmd_restore(api, args.file, args.yes, args.target)


if __name__ == "__main__":
    main()
