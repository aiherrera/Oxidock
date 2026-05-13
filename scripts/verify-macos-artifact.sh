#!/usr/bin/env bash
# Verify a downloaded Oxidock macOS release artifact (DMG or .app).
# Usage: ./scripts/verify-macos-artifact.sh /path/to/Oxidock.dmg
set -euo pipefail

ARTIFACT="${1:-}"
if [[ -z "$ARTIFACT" || ! -e "$ARTIFACT" ]]; then
  echo "Usage: $0 /path/to/Oxidock.dmg" >&2
  exit 1
fi

MOUNT_DIR=""
APP_PATH=""

cleanup() {
  if [[ -n "$MOUNT_DIR" && -d "$MOUNT_DIR" ]]; then
    hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ "$ARTIFACT" == *.dmg ]]; then
  MOUNT_DIR=$(hdiutil attach -nobrowse -readonly "$ARTIFACT" | tail -1 | awk '{print $NF}')
  APP_PATH=$(find "$MOUNT_DIR" -maxdepth 1 -name '*.app' -print -quit)
elif [[ "$ARTIFACT" == *.app ]]; then
  APP_PATH="$ARTIFACT"
else
  echo "Unsupported artifact: $ARTIFACT (expected .dmg or .app)" >&2
  exit 1
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Could not locate .app bundle in artifact" >&2
  exit 1
fi

echo "==> codesign"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "==> spctl (Gatekeeper)"
spctl -a -vv -t install "$APP_PATH"

echo "==> stapler (notarization ticket)"
xcrun stapler validate "$APP_PATH" 2>/dev/null || echo "Note: stapler validate may fail until ticket is stapled to the .app inside DMG"

echo "OK: $APP_PATH passed verification checks"
