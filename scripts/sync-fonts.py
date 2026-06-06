#!/usr/bin/env python3
"""Download Google Fonts woff2 subsets (latin + latin-ext) and append local
@font-face rules to src/assets/fonts/fonts.css. Offline-first: fonts are
bundled, never fetched at runtime. Re-runnable — skips families already present.
"""
import re
import sys
import urllib.request
import hashlib
from pathlib import Path

FONTS_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "fonts"
CSS = FONTS_DIR / "fonts.css"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# family display name -> google css2 query spec
FAMILIES = {
    "EB Garamond": "EB+Garamond:ital,wght@0,400;0,600;1,400",
    "Cinzel": "Cinzel:wght@400;700",
    "UnifrakturMaguntia": "UnifrakturMaguntia",
    "Caveat": "Caveat:wght@400;600",
    "Special Elite": "Special+Elite",
    "JetBrains Mono": "JetBrains+Mono:wght@400;600",
    "Cormorant Unicase": "Cormorant+Unicase:wght@400;700",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main() -> int:
    existing = CSS.read_text(encoding="utf-8") if CSS.exists() else ""
    appended = []
    for name, spec in FAMILIES.items():
        if f"font-family: '{name}'" in existing:
            print(f"skip {name} (already present)")
            continue
        url = f"https://fonts.googleapis.com/css2?family={spec}&display=block"
        try:
            css = fetch(url).decode("utf-8")
        except Exception as e:  # noqa: BLE001
            print(f"FAIL fetch {name}: {e}", file=sys.stderr)
            return 1
        # Each @font-face block carries a /* subset */ comment before it.
        blocks = re.split(r"(/\*[^*]+\*/)\n", css)
        # Re-pair comment with following block.
        out = [f"\n/* ===== {name} (OFL, Google Fonts) ===== */"]
        i = 1
        while i < len(blocks):
            comment = blocks[i]
            block = blocks[i + 1] if i + 1 < len(blocks) else ""
            i += 2
            m = re.search(r"src:\s*url\(([^)]+)\)\s*format\('woff2'\)", block)
            if not m:
                continue
            remote = m.group(1)
            data = fetch(remote)
            h = hashlib.sha1(remote.encode()).hexdigest()[:16]
            fname = f"wh-{name.lower().replace(' ', '-')}-{h}.woff2"
            (FONTS_DIR / fname).write_bytes(data)
            local_block = block.replace(remote, f"./{fname}")
            out.append(comment)
            out.append(local_block.rstrip())
        appended.append("\n".join(out))
        print(f"added {name}")
    if appended:
        with CSS.open("a", encoding="utf-8") as f:
            f.write("\n" + "\n".join(appended) + "\n")
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
