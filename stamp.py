#!/usr/bin/env python3
"""Stempler ?v=<hash> på css og js i HTML-filerne.

Uden det kan en browser sidde med app.js fra i forgårs og style.css fra i
dag, og så ser siden i bedste fald forkert ud. Hashen ændrer sig kun når
filen ændrer sig, så en uændret fil bliver ved med at komme fra cachen.

Bruges to steder, og det skal give præcis samme resultat begge veje:

  * deploy.py stempler i hukommelsen under upload (rører ikke arbejdstræet)
  * GitHub Actions kører `python stamp.py site` og stempler filerne på disk
    i sit eget midlertidige checkout før FTP-uploadet
"""
import hashlib
import os
import re
import sys

# Filer der skal have et versionsstempel, når de refereres fra HTML.
ASSETS = ("style.css", "court.js", "engine.js", "scenes.js", "app.js")


def digest(site_dir: str, name: str) -> str:
    with open(os.path.join(site_dir, name), "rb") as fh:
        return hashlib.md5(fh.read()).hexdigest()[:8]


def bust(html: str, site_dir: str) -> str:
    """Sætter (eller opdaterer) ?v=<hash> på hver reference i ASSETS."""
    for name in ASSETS:
        html = re.sub(
            r'(["\'])' + re.escape(name) + r'(\?v=[0-9a-f]+)?\1',
            lambda m, n=name: f'{m.group(1)}{n}?v={digest(site_dir, n)}{m.group(1)}',
            html,
        )
    return html


def stamp_dir(site_dir: str) -> int:
    changed = 0
    for name in sorted(os.listdir(site_dir)):
        if not name.endswith(".html") or name.startswith("_"):
            continue
        path = os.path.join(site_dir, name)
        with open(path, encoding="utf-8") as fh:
            before = fh.read()
        after = bust(before, site_dir)
        if after != before:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(after)
            changed += 1
        print(f"  stemplet {name}")
    return changed


if __name__ == "__main__":
    site = sys.argv[1] if len(sys.argv) > 1 else "site"
    stamp_dir(site)
