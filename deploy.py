#!/usr/bin/env python3
"""Deploy floorball-siden til vhg.dk/floorball via FTP.

    python deploy.py

Siden er et selvstændigt projekt, men bor i en undermappe på vhg.dk's
webhotel (Netgiganten). Deployet køres i hånden; der er ingen GitHub Actions
(fjernet 2026-10-22). To ting følger af det:

  * vhg-repoets deploy.py rører ikke public_html/floorball/: den sender kun
    vhg-repoets egne filer, sletter intet, og `floorball/**` står i dens
    UDELAD-liste for en sikkerheds skyld. Lad linjen blive stående.
  * Vi uploader kun — der slettes aldrig noget på serveren. Det er med
    vilje: kommentar-databasen (api/data/comments.sqlite) findes kun
    derovre og må ikke røres.

HTML-filerne får stemplet ?v=<hash> på css/js, så en browser med en gammel
kopi i cachen ikke sidder med halvdelen af siden fra i forgårs.

Loginoplysninger læses fra .ftp-credentials (ikke i git):
    FTP_HOST=ftp.vhg.dk
    FTP_USER=allan@vhg.dk
    FTP_PASS=...          # samme konto som vhg-repoets .ftp-credentials
"""
import ftplib
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stamp import bust           # versionsstemplingen, også brugbar for sig

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL = os.path.join(HERE, "site")
REMOTE = "public_html/floorball"     # relativt til FTP-login
SKIP_DIRS = {"data"}                 # ligger kun på serveren (SQLite)

creds = {}
with open(os.path.join(HERE, ".ftp-credentials")) as fh:
    for line in fh:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            creds[k] = v


def ensure(f, path):
    try:
        f.mkd(path)
    except ftplib.error_perm:
        pass          # findes allerede


def upload(f, local, remote):
    ensure(f, remote)
    for name in sorted(os.listdir(local)):
        lp, rp = os.path.join(local, name), remote + "/" + name
        if name.startswith("_") or name.startswith("."):
            continue
        if os.path.isdir(lp):
            if name in SKIP_DIRS:
                continue
            upload(f, lp, rp)
        elif name.endswith(".html"):
            with open(lp, encoding="utf-8") as fh:
                html = bust(fh.read(), LOCAL).encode("utf-8")
            f.storbinary("STOR " + rp, io.BytesIO(html))
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
    print("Færdig -> https://www.vhg.dk/floorball/")
