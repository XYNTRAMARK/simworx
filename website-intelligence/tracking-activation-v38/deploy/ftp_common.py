"""Verified read-only FTPS and full-backup utilities; no remote writes."""
from __future__ import annotations

import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import shutil
import ssl
import sys
import tarfile
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = "/htdocs"
WORK = Path("/tmp/simworx-tracking-activation-v38")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stream_hash(handle) -> str:
    checksum = hashlib.sha256()
    while True:
        block = handle.read(1024 * 1024)
        if not block:
            return checksum.hexdigest()
        checksum.update(block)


def file_hash(path: Path) -> str:
    with path.open("rb") as handle:
        return stream_hash(handle)


def canonical(data) -> bytes:
    return (json.dumps(data, sort_keys=True, indent=2) + "\n").encode()


class VerifiedFTP(ftplib.FTP_TLS):
    prefer_epsv = False

    def makepasv(self):
        if self.prefer_epsv:
            try:
                return ftplib.parse229(self.sendcmd("EPSV"), self.sock.getpeername())
            except ftplib.error_perm:
                pass
        return super().makepasv()

    def ntransfercmd(self, command, rest=None):
        try:
            return super().ntransfercmd(command, rest)
        except ftplib.error_temp as error:
            if str(error).startswith("425") and command.split(" ", 1)[0] in {"RETR", "STOR", "LIST", "MLSD"} and not self.prefer_epsv:
                self.prefer_epsv = True
                return super().ntransfercmd(command, rest)
            raise


def parse_host(raw: str):
    parsed = urlsplit(raw.strip() if "://" in raw else "ftp://" + raw.strip())
    if parsed.scheme not in {"ftp", "ftps"} or not parsed.hostname:
        raise RuntimeError("FTP_HOST must identify an FTP/FTPS host.")
    if parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise RuntimeError("FTP_HOST must contain only the server address and optional port.")
    if any(char in raw for char in "\r\n\x00"):
        raise RuntimeError("FTP_HOST contains unsafe characters.")
    return parsed.hostname, parsed.port or 21


def connect():
    raw = os.environ.get("FTP_HOST", "")
    user, password = os.environ.get("FTP_USERNAME", ""), os.environ.get("FTP_PASSWORD", "")
    if not raw or not user or not password:
        raise RuntimeError("The existing hosting FTP secrets are required.")
    host, port = parse_host(raw)
    ftp = VerifiedFTP(context=ssl.create_default_context(), timeout=45)
    ftp.connect(host, port)
    ftp.login(user, password)
    ftp.prot_p()
    return ftp


def entries(ftp, folder):
    result, seen = [], set()
    for name, facts in ftp.mlsd(folder):
        kind = facts.get("type", "").lower()
        if kind in {"cdir", "pdir"}:
            continue
        if not name or name in {".", ".."} or any(c in name for c in "/\\\r\n\x00") or name in seen:
            raise RuntimeError("Unsafe or duplicate live filename prevents a complete backup.")
        if kind not in {"file", "dir"}:
            raise RuntimeError("Unsupported FTP entry prevents a complete backup.")
        seen.add(name)
        result.append((name, {key: str(facts[key]) for key in ("type", "size", "modify") if key in facts}))
    return sorted(result)


def inventory(ftp, folder=ROOT):
    if folder != ROOT and not folder.startswith(ROOT + "/"):
        raise RuntimeError("Read inventory escaped the website root.")
    result = {}
    for name, facts in entries(ftp, folder):
        remote = posixpath.join(folder, name)
        result[remote] = facts
        if facts["type"].lower() == "dir":
            result.update(inventory(ftp, remote))
    return result


def remote_hash(ftp, path, output=None):
    checksum, length = hashlib.sha256(), 0

    def consume(block):
        nonlocal length
        checksum.update(block)
        length += len(block)
        if output is not None:
            output.write(block)

    ftp.retrbinary("RETR " + path, consume, blocksize=65536)
    return checksum.hexdigest(), length


def fresh_inventory():
    with connect() as ftp:
        return inventory(ftp)


def backup_local_path(site, remote):
    if not remote.startswith(ROOT + "/") or any(part in {"", ".", ".."} for part in remote[len(ROOT) + 1:].split("/")):
        raise RuntimeError("Unsafe remote path in backup inventory.")
    return site / "htdocs" / remote[len(ROOT) + 1:]


def download_tasks(tasks):
    """Four independent FTPS connections; stream each file once and checksum it."""
    if not tasks:
        return {}
    buckets, loads = [[], [], [], []], [0, 0, 0, 0]
    for task in sorted(tasks, key=lambda item: int(item[1].get("size", 0)), reverse=True):
        index = min(range(4), key=lambda item: loads[item])
        buckets[index].append(task)
        loads[index] += max(1, int(task[1].get("size", 0)))
    lock = threading.Lock()
    progress = {"files": 0, "bytes": 0}

    def worker(batch):
        completed = {}
        ftp = None
        try:
            for remote, facts, local in batch:
                partial = WORK / "transfers" / (digest(remote.encode()) + ".part")
                partial.parent.mkdir(parents=True, exist_ok=True)
                for attempt in range(2):
                    try:
                        if ftp is None:
                            ftp = connect()
                        with partial.open("wb") as handle:
                            sha, count = remote_hash(ftp, remote, handle)
                        if "size" in facts and count != int(facts["size"]):
                            partial.unlink(missing_ok=True)
                            break  # Refresh inventory and copy the changed version next pass.
                        local.parent.mkdir(parents=True, exist_ok=True)
                        partial.replace(local)  # Local scratch only; no server mutation.
                        completed[remote] = sha
                        with lock:
                            progress["files"] += 1
                            progress["bytes"] += count
                            if progress["files"] % 20 == 0 or progress["files"] == len(tasks):
                                print("Downloaded backup files:", progress["files"], "/", len(tasks), "bytes:", progress["bytes"], flush=True)
                        break
                    except ftplib.error_perm as error:
                        partial.unlink(missing_ok=True)
                        if not str(error).startswith("550"):
                            raise
                        break  # A concurrently removed file is handled by the next inventory.
                    except (OSError, EOFError, ftplib.error_temp):
                        partial.unlink(missing_ok=True)
                        if ftp is not None:
                            ftp.close()
                        ftp = None
                        if attempt == 1:
                            raise
            return completed
        finally:
            if ftp is not None:
                try:
                    ftp.quit()
                except (OSError, EOFError, ftplib.Error):
                    ftp.close()

    completed = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(worker, [batch for batch in buckets if batch]):
            completed.update(result)
    return completed


def stable_copy_site(site, initial, downloader=None, inventory_reader=None, max_passes=4):
    """Refresh only changed files in a bounded read-only backup until stable."""
    downloader = downloader or download_tasks
    inventory_reader = inventory_reader or fresh_inventory
    snapshot, copied, checksums = initial, {}, {}
    for pass_number in range(1, max_passes + 1):
        # Remove obsolete scratch paths only; never remove anything on the server.
        for remote in sorted(set(copied) - set(snapshot), key=len, reverse=True):
            local = backup_local_path(site, remote)
            if local.is_dir():
                shutil.rmtree(local)
            else:
                local.unlink(missing_ok=True)
            copied.pop(remote, None)
            checksums.pop(remote, None)
        tasks = []
        for remote, facts in sorted(snapshot.items(), key=lambda item: (item[0].count("/"), item[0])):
            local = backup_local_path(site, remote)
            if facts["type"].lower() == "dir":
                if local.is_file():
                    local.unlink()
                local.mkdir(parents=True, exist_ok=True)
                copied.pop(remote, None)
                checksums.pop(remote, None)
            elif copied.get(remote) != facts:
                if local.is_dir():
                    shutil.rmtree(local)
                tasks.append((remote, facts, local))
        total = sum(int(facts.get("size", 0)) for facts in snapshot.values() if facts["type"].lower() == "file")
        print("Backup pass:", pass_number, "files to copy:", len(tasks), "total live bytes:", total, flush=True)
        completed = downloader(tasks)
        for remote, sha in completed.items():
            copied[remote] = dict(snapshot[remote])
            checksums[remote] = sha
        current = inventory_reader()
        files = {path for path, facts in current.items() if facts["type"].lower() == "file"}
        if current == snapshot and set(checksums) == files and all(copied.get(path) == current[path] for path in files):
            return current, checksums, total
        changed = sorted(path for path in set(current) | set(snapshot) if current.get(path) != snapshot.get(path) or path in files and copied.get(path) != current[path])
        print("Backup refreshing changed paths:", len(changed), "sample:", ", ".join(path.removeprefix(ROOT + "/") for path in changed[:10]), flush=True)
        # Drop removed directories and descendants locally, including empty dirs.
        for remote in sorted(set(snapshot) - set(current), key=len, reverse=True):
            local = backup_local_path(site, remote)
            if local.is_dir():
                shutil.rmtree(local)
            else:
                local.unlink(missing_ok=True)
            copied.pop(remote, None)
            checksums.pop(remote, None)
        snapshot = current
    raise RuntimeError("The complete live backup did not stabilize after bounded refresh passes; no upload attempted.")

