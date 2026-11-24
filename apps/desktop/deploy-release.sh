#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOWNLOAD_DIR="${TYPECLUB_DOWNLOADS_DIR:-./downloads}"

cd "$SCRIPT_DIR"

VERSION=$(node -p "require('./package.json').version")
RELEASE_DIR="release/${VERSION}"
DATE=$(date -u +%Y-%m-%d)

echo "==> Building Type Club v${VERSION}..."
npm run build

echo "==> Copying artifacts to ${DOWNLOAD_DIR}..."
mkdir -p "$DOWNLOAD_DIR"
for artifact in "${RELEASE_DIR}/"*; do
    if [[ -f "$artifact" ]]; then
        cp -v "$artifact" "${DOWNLOAD_DIR}/"
    fi
done

echo "==> Generating latest.json..."

python3 - "$DOWNLOAD_DIR" "$RELEASE_DIR" "$VERSION" "$DATE" <<'PYEOF'
import hashlib
import json
import os
import sys

downloads, release_dir, version, date = sys.argv[1:]

manifest = {
    "version": version,
    "releaseDate": date,
    "platforms": {
        "windows": None,
        "linux": None,
        "macos": None,
    }
}

for f in sorted(os.listdir(release_dir)):
    if not f.startswith((f"TypeClub-Windows-{version}.", f"TypeClub-Linux-{version}.", f"TypeClub-Mac-{version}-")):
        continue
    path = os.path.join(downloads, f)
    if not os.path.isfile(path):
        continue
    size = os.path.getsize(path)
    with open(path, "rb") as artifact:
        digest = hashlib.sha256()
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    entry = {"file": f, "size": size, "sha256": digest.hexdigest()}

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

if not manifest["platforms"]["linux"]:
    raise SystemExit("The current Linux AppImage is missing from the release")

manifest_path = os.path.join(downloads, "latest.json")
with open(manifest_path + ".tmp", "w") as fp:
    json.dump(manifest, fp, indent=2)
os.replace(manifest_path + ".tmp", manifest_path)

print(json.dumps(manifest, indent=2))
PYEOF

echo ""
echo "==> Done! Artifacts saved to ${DOWNLOAD_DIR}"
echo "    Update the web frontend and restart the web server"
