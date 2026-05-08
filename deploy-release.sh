#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOWNLOAD_DIR="/home/chebukek/typeclub-downloads"

cd "$SCRIPT_DIR"

VERSION=$(node -p "require('./package.json').version")
RELEASE_DIR="release/${VERSION}"
DATE=$(date -u +%Y-%m-%d)

echo "==> Building Type Club v${VERSION}..."
npm run build

echo "==> Copying artifacts to ${DOWNLOAD_DIR}..."
cp -v "${RELEASE_DIR}/"* "${DOWNLOAD_DIR}/" 2>/dev/null || true

echo "==> Generating latest.json..."

# Build JSON manually with jq or python
python3 - <<PYEOF
import json, os, sys

downloads = "$DOWNLOAD_DIR"
version = "$VERSION"
date = "$DATE"

manifest = {
    "version": version,
    "releaseDate": date,
    "platforms": {
        "windows": None,
        "linux": None,
        "macos": None,
    }
}

for f in sorted(os.listdir(downloads)):
    if f.startswith(".") or f == "latest.json":
        continue
    path = os.path.join(downloads, f)
    if not os.path.isfile(path):
        continue
    size = os.path.getsize(path)
    entry = {"file": f, "size": size}

    lower = f.lower()
    if "linux" in lower and f.endswith(".AppImage"):
        manifest["platforms"]["linux"] = {"appimage": entry}
    elif "windows" in lower:
        plat = manifest["platforms"].get("windows") or {}
        if f.endswith(".exe"):
            plat["installer"] = entry
        elif f.endswith(".zip"):
            plat["portable"] = entry
        manifest["platforms"]["windows"] = plat
    elif "mac" in lower and f.endswith(".dmg"):
        manifest["platforms"]["macos"] = {"dmg": entry}

# Remove None platforms
if not manifest["platforms"]["windows"]:
    manifest["platforms"]["windows"] = None
if not manifest["platforms"]["linux"]:
    manifest["platforms"]["linux"] = None

with open(os.path.join(downloads, "latest.json"), "w") as fp:
    json.dump(manifest, fp, indent=2)

print(json.dumps(manifest, indent=2))
PYEOF

echo ""
echo "==> Done! https://type-club.ru/downloads/latest.json"
echo "    Next: rebuild the web frontend and restart nginx"
