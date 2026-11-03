"""Replace one reviewed reporting calculation file after a retained full backup.

Only /htdocs/reports/analytics.js and transaction-owned adjacent temporary files
may be written. No website pages, tracking assets, or database records are changed.
"""
from __future__ import annotations
import io
import json
import os
from pathlib import Path
import posixpath
import re
import sys
import tarfile
from datetime import datetime, timezone
from urllib.request import Request, urlopen

SOURCE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SOURCE.parent / 'tracking-activation-v38' / 'deploy'))
import ftp_common as common

WORK = Path('/tmp/simworx-report-test-filter')
common.WORK = WORK
TARGET = '/htdocs/reports/analytics.js'
HOMEPAGE = '/htdocs/index.html'
PUBLIC = 'https://sim-worx.com/reports/analytics.js'
SHA = re.compile(r'^[a-f0-9]{64}$')


def plan():
    value = json.loads((SOURCE / 'plan.json').read_text())
    if not isinstance(value, dict) or set(value) != {'path', 'source', 'expected_before', 'expected_after'}:
        raise RuntimeError('The exact four-field reporting calculation plan is required')
    if value['path'] != TARGET or value['source'] != 'reports/analytics.js':
        raise RuntimeError('Only the exact reports/analytics.js calculation file is authorized')
    if not all(isinstance(value[key], str) and SHA.fullmatch(value[key]) for key in ('expected_before', 'expected_after')):
        raise RuntimeError('Reviewed before and after SHA-256 values are required')
    local = SOURCE / value['source']
    if local.is_symlink() or not local.is_file() or SOURCE not in local.resolve().parents:
        raise RuntimeError('The reporting source must be a regular local reviewed file')
    data = local.read_bytes()
    if not data or len(data) > 250000 or common.digest(data) != value['expected_after']:
        raise RuntimeError('Reporting source differs from its reviewed checksum or size')
    if value['expected_before'] == value['expected_after']:
        raise RuntimeError('A reporting calculation change must be nonempty')
    return value, data


def make_archive(site, before, checksums):
    manifest = {'inventory': before, 'sha256': checksums}
    (site / 'backup-manifest.json').write_bytes(common.canonical(manifest))
    archive = WORK / 'live-htdocs.tar.gz'
    with tarfile.open(archive, 'w:gz') as output:
        output.add(site / 'htdocs', arcname='htdocs', recursive=True)
        output.add(site / 'backup-manifest.json', arcname='backup-manifest.json')
    seen = set()
    with tarfile.open(archive, 'r|gz') as verify:
        for member in verify:
            if not member.isfile():
                continue
            handle = verify.extractfile(member)
            if member.name == 'backup-manifest.json':
                if handle is None or handle.read() != common.canonical(manifest):
                    raise RuntimeError('Full backup manifest failed verification')
                continue
            remote = '/' + member.name
            if remote not in checksums or member.name in seen or handle is None or common.stream_hash(handle) != checksums[remote]:
                raise RuntimeError('Full backup archive checksum mismatch')
            seen.add(member.name)
    if seen != {path.lstrip('/') for path in checksums}:
        raise RuntimeError('Full backup archive file list mismatch')
    return archive


def backup():
    value, data = plan()
    if WORK.exists():
        raise RuntimeError('Prior deployment evidence exists; preserve it before retrying')
    WORK.mkdir(mode=0o700)
    site = WORK / 'site'
    site.mkdir(mode=0o700)
    before, checksums, total = common.stable_copy_site(site, common.fresh_inventory())
    if before.get(TARGET, {}).get('type', '').lower() != 'file' or checksums.get(TARGET) != value['expected_before']:
        raise RuntimeError('The reviewed reporting calculation changed before the full backup')
    if HOMEPAGE not in checksums:
        raise RuntimeError('The unchanged public homepage cannot be verified')
    archive = make_archive(site, before, checksums)
    (WORK / 'payload.js').write_bytes(data)
    review = {
        'path': TARGET, 'before_sha256': value['expected_before'], 'after_sha256': value['expected_after'],
        'homepage_sha256': checksums[HOMEPAGE], 'archive_sha256': common.file_hash(archive),
        'backup_files': len(checksums), 'backup_bytes': total,
        'created_at': datetime.now(timezone.utc).isoformat(), 'database_mutations': False,
        'public_pages_modified': False,
    }
    (WORK / 'change-manifest.json').write_bytes(common.canonical(review))
    (WORK / 'verified-backup.json').write_bytes(common.canonical({'inventory': before, 'sha256': checksums, 'review': review}))
    print('Full backup verified:', len(checksums), 'files;', total, 'bytes. Planned write: reports/analytics.js only. No remote writes.', flush=True)


def temporary_path(token, rollback=False):
    if not re.fullmatch(r'[a-f0-9]{12}', token):
        raise RuntimeError('Invalid transaction token')
    return '/htdocs/reports/.simworx-report-test-filter-' + token + ('.rollback' if rollback else '.upload')


def ensure_temp_absent(ftp, path):
    if posixpath.basename(path) in {name for name, _ in common.entries(ftp, '/htdocs/reports')}:
        raise RuntimeError('A transaction temporary file already exists')


def install(ftp, before, review, token, transaction):
    if review.get('path') != TARGET:
        raise RuntimeError('Write target escaped the single calculation allowlist')
    if common.inventory(ftp) != before:
        raise RuntimeError('Live inventory changed after backup; no writes attempted')
    if common.remote_hash(ftp, TARGET)[0] != review['before_sha256']:
        raise RuntimeError('Reporting calculation changed before deployment')
    data = (WORK / 'payload.js').read_bytes()
    if common.digest(data) != review['after_sha256']:
        raise RuntimeError('Prepared reporting calculation differs from its reviewed checksum')
    temp = temporary_path(token)
    ensure_temp_absent(ftp, temp)
    transaction['temps'].add(temp)
    ftp.storbinary('STOR ' + temp, io.BytesIO(data), blocksize=65536)
    if common.remote_hash(ftp, temp)[0] != review['after_sha256']:
        raise RuntimeError('Staged calculation failed checksum verification')
    if common.remote_hash(ftp, TARGET)[0] != review['before_sha256']:
        raise RuntimeError('Reporting calculation changed before atomic replacement')
    # A rename can succeed while its reply is lost: record intent beforehand.
    transaction['changed'] = True
    ftp.rename(temp, TARGET)
    transaction['temps'].discard(temp)
    if common.remote_hash(ftp, TARGET)[0] != review['after_sha256']:
        raise RuntimeError('Installed calculation failed checksum verification')


def verify_scope(ftp, before, review):
    after = common.inventory(ftp)
    if set(after) != set(before):
        raise RuntimeError('Unexpected new or missing live paths appeared during reporting update')
    for path, facts in before.items():
        if after[path].get('type') != facts.get('type'):
            raise RuntimeError('A live path changed type')
        if path not in {TARGET, '/htdocs/reports'} and after[path] != facts:
            raise RuntimeError('An unrelated live path changed during reporting update: ' + path)
    if common.remote_hash(ftp, TARGET)[0] != review['after_sha256']:
        raise RuntimeError('Reporting calculation verification failed')
    if common.remote_hash(ftp, HOMEPAGE)[0] != review['homepage_sha256']:
        raise RuntimeError('The public homepage changed during reporting update')


def rollback(ftp, review, token, transaction):
    if review.get('path') != TARGET:
        raise RuntimeError('Rollback target escaped the single calculation allowlist')
    failures = []
    if transaction['changed']:
        current = common.remote_hash(ftp, TARGET)[0]
        if current == review['after_sha256']:
            original = (WORK / 'site' / TARGET.lstrip('/')).read_bytes()
            if common.digest(original) != review['before_sha256']:
                raise RuntimeError('The backed-up original failed rollback validation')
            temp = temporary_path(token, True)
            ensure_temp_absent(ftp, temp)
            transaction['temps'].add(temp)
            ftp.storbinary('STOR ' + temp, io.BytesIO(original), blocksize=65536)
            if common.remote_hash(ftp, temp)[0] != review['before_sha256']:
                raise RuntimeError('Rollback staging failed verification')
            if common.remote_hash(ftp, TARGET)[0] != review['after_sha256']:
                failures.append(TARGET)
            else:
                ftp.rename(temp, TARGET)
                transaction['temps'].discard(temp)
                if common.remote_hash(ftp, TARGET)[0] != review['before_sha256']:
                    failures.append(TARGET)
        elif current != review['before_sha256']:
            failures.append(TARGET)
    # Only transaction-owned temporary staging files may be removed. The live
    # calculation, public website files, and database records are never deleted.
    owned = {temporary_path(token), temporary_path(token, True)}
    for path in transaction['temps']:
        if path not in owned:
            raise RuntimeError('Unsafe temporary cleanup path')
        try:
            ftp.delete(path)
        except common.ftplib.error_perm as error:
            if not str(error).startswith('550'):
                failures.append(path)
    if failures:
        raise RuntimeError('Rollback preserved independently changed files; review required: ' + ', '.join(failures))
    print('Restored only this transaction\'s reporting calculation change.', flush=True)


def public_check(review):
    request = Request(PUBLIC + '?sw-report-filter=' + review['after_sha256'][:12], headers={
        'Cache-Control': 'no-cache', 'User-Agent': 'Simworx-report-test-filter-verification'})
    with urlopen(request, timeout=25) as response:
        data = response.read()
    if common.digest(data) != review['after_sha256']:
        raise RuntimeError('The public reporting calculation differs from the reviewed checksum')
    print('Reporting calculation verified through HTTPS.', flush=True)


def publish():
    value, data = plan()
    if not re.fullmatch(r'[1-9][0-9]*', os.environ.get('RETAINED_BACKUP_ARTIFACT_ID', '')):
        raise RuntimeError('Retained encrypted full-backup artifact ID required before writes')
    evidence = json.loads((WORK / 'verified-backup.json').read_text())
    review = evidence['review']
    archive, encrypted = WORK / 'live-htdocs.tar.gz', WORK / 'live-htdocs.tar.gz.enc'
    if not encrypted.is_file() or not encrypted.stat().st_size or common.file_hash(archive) != review['archive_sha256']:
        raise RuntimeError('The verified and retained full backup is unavailable')
    if review['path'] != TARGET or review['before_sha256'] != value['expected_before'] or review['after_sha256'] != value['expected_after'] or common.digest(data) != review['after_sha256']:
        raise RuntimeError('The deployment plan changed after backup review')
    token = common.digest(common.canonical(review))[:12]
    transaction = {'changed': False, 'temps': set()}
    try:
        with common.connect() as ftp:
            install(ftp, evidence['inventory'], review, token, transaction)
            verify_scope(ftp, evidence['inventory'], review)
    except Exception:
        if transaction['changed'] or transaction['temps']:
            with common.connect() as ftp:
                rollback(ftp, review, token, transaction)
        raise
    proof = {**review, 'ftp_verified_at': datetime.now(timezone.utc).isoformat(), 'unrelated_paths_unchanged': True}
    (WORK / 'report-filter-ftp-verified.json').write_bytes(common.canonical(proof))
    # An HTTPS verifier outage does not undo an already FTP-verified calculation.
    public_check(review)
    (WORK / 'report-filter-deployed.json').write_bytes(common.canonical({**proof, 'https_verified_at': datetime.now(timezone.utc).isoformat()}))
    print('Test-visit filtering deployed to reports/analytics.js only. Website pages and stored records unchanged.', flush=True)


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in {'backup', 'publish', 'validate'}:
            raise RuntimeError('Use backup, publish, or validate')
        {'backup': backup, 'publish': publish, 'validate': plan}[sys.argv[1]]()
    except Exception as error:
        message = str(error)
        for key in ('FTP_HOST', 'FTP_USERNAME', 'FTP_PASSWORD'):
            if os.environ.get(key):
                message = message.replace(os.environ[key], '[redacted]')
        print('::error::Reporting update stopped (' + type(error).__name__ + '): ' + message[:1000].replace('\n', ' '), file=sys.stderr)
        raise SystemExit(1)
