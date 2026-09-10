#!/bin/bash
# Build, replace the installed copy, relaunch. Without this the freshly built
# bundle sits in target/ while /Applications keeps serving the previous binary —
# which looks exactly like "the fix didn't work".
set -euo pipefail
cd "$(dirname "$0")"
SRC="src-tauri/target/release/bundle/macos/FractalDesk.app"
DEST="/Applications/FractalDesk.app"

pnpm tauri build
pkill -f "FractalDesk.app/Contents/MacOS/fractaldesk" 2>/dev/null || true
sleep 1
rm -rf "$DEST"
ditto "$SRC" "$DEST"
open "$DEST"

echo
echo "installed $(md5 -q "$DEST/Contents/MacOS/fractaldesk")"
echo "built     $(md5 -q "$SRC/Contents/MacOS/fractaldesk")"
echo "-> if those differ, the install did not take"
