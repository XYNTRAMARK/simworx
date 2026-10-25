"""Read-only inspection after an interrupted reports deployment."""
import json
import sys
import time
from urllib.error import URLError
import reports_ftp as deployment
import os

if os.environ.get('REPORTS_PUBLIC_BASE') in {'https://sim-worx.com', 'https://www.sim-worx.com'}:
    deployment.PUBLIC = os.environ['REPORTS_PUBLIC_BASE']


def main():
    payload, hashes, fingerprint = deployment.validate_payload()
    with deployment.connect() as ftp:
        state = deployment.inventory(ftp)
        reports = {path: facts for path, facts in state.items() if path.startswith(deployment.TARGET + "/")}
        print("Reports files found:", len(reports), flush=True)
        if not reports:
            raise RuntimeError("Reports are absent; the interrupted attempt performed no upload.")
        expected = {deployment.destination(name) for name in deployment.UPLOAD_ORDER}
        if set(reports) != expected:
            raise RuntimeError("The new reports folder is incomplete or contains unexpected files.")
        for name, content in payload.items():
            if deployment.remote_hash(ftp, deployment.destination(name))[0] != deployment.digest(content):
                raise RuntimeError("Reports FTP content differs from its reviewed source: " + name)
        chunks = []
        ftp.retrbinary("RETR " + deployment.destination("deployment.json"), chunks.append)
        marker = json.loads(b"".join(chunks))
        if marker.get("project") != "simworx-website-intelligence" or marker.get("payload_sha256") != fingerprint:
            raise RuntimeError("Reports deployment marker differs from the reviewed source.")
        print("All nine reports FTP files match the reviewed deployment. Commit:", marker.get("commit"), flush=True)
    for path, expected in [("/reports/", payload["index.html"]), ("/reports/app.js", payload["app.js"]), ("/reports/styles.css", payload["styles.css"])]:
        for attempt in range(3):
            try:
                print("Checking public HTTPS:", path, "attempt", attempt + 1, flush=True)
                body, headers = deployment.public_bytes(path, fingerprint[:16] + "-verify-" + str(attempt))
                if deployment.digest(body) != deployment.digest(expected):
                    raise RuntimeError("Public reports content differs from FTP source: " + path)
                print("HTTPS checksum verified:", path, flush=True)
                break
            except (URLError, TimeoutError, ConnectionError):
                if attempt == 2:
                    raise
                time.sleep(2)
    print("Verified live static reports:", deployment.PUBLIC + "/reports/", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        message = str(error)
        import os
        for key in ("FTP_HOST", "FTP_USERNAME", "FTP_PASSWORD"):
            if os.environ.get(key):
                message = message.replace(os.environ[key], "[redacted]")
        print("Reports inspection:", type(error).__name__, message, file=sys.stderr)
        raise SystemExit(1)
