#!/usr/bin/env python3
"""Deploy floorball-siden til aogj.com/floorball via FTP.

    python deploy.py

index.html får stemplet ?v=<hash> på css/js, fordi one.com ligger bag en
Varnish der ellers kan servere forældet CSS/JS i timevis.

Loginoplysninger læses fra .ftp-credentials (ikke i git):
    FTP_HOST=...
    FTP_USER=...
    FTP_PASS=...
"""
import ftplib
import hashlib
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL = os.path.join(HERE, "site")
REMOTE = "floorball"                 # relativt til FTP-login (= web-roden)
BUST = ("style.css", "court.js", "engine.js", "scenes.js", "app.js")

creds = {}
with open(os.path.join(HERE, ".ftp-credentials")) as fh:
    for line in fh:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            creds[k] = v


def digest(name):
    with open(os.path.join(LOCAL, name), "rb") as fh:
        return hashlib.md5(fh.read()).hexdigest()[:8]


def bust(html_bytes):
    html = html_bytes.decode("utf-8")
    for name in BUST:
        html = re.sub(
            r'(["\'])' + re.escape(name) + r'(\?v=[0-9a-f]+)?\1',
            lambda m, n=name: f'{m.group(1)}{n}?v={digest(n)}{m.group(1)}',
            html,
        )
    return html.encode("utf-8")


def ensure(f, path):
    try:
        f.mkd(path)
    except ftplib.error_perm:
        pass


def upload(f, local, remote):
    ensure(f, remote)
    for name in sorted(os.listdir(local)):
        lp, rp = os.path.join(local, name), remote + "/" + name
        if name.startswith("."):
            continue
        if os.path.isdir(lp):
            upload(f, lp, rp)
        elif name == "index.html":
            f.storbinary("STOR " + rp, io.BytesIO(bust(open(lp, "rb").read())))
            print("  ->", rp, "(cache-bustet)")
        else:
            with open(lp, "rb") as fh:
                f.storbinary("STOR " + rp, fh)
            print("  ->", rp)


if __name__ == "__main__":
    f = ftplib.FTP(creds["FTP_HOST"], timeout=90)
    f.login(creds["FTP_USER"], creds["FTP_PASS"])
    print(f"Uploader site/ -> ftp://{creds['FTP_HOST']}/{REMOTE}/ ...")
    upload(f, LOCAL, REMOTE)
    f.quit()
    print("Færdig -> https://aogj.com/floorball")
