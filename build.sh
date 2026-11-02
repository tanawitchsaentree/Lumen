#!/bin/sh
# Concatenate src/ parts into the single self-contained index.html
cd "$(dirname "$0")"
cat src/01-head.html src/02-style.css src/03-body.html src/10-core.js src/20-md.js src/30-engine.js src/40-thread.js src/50-ui.js src/60-composer.js src/70-boot.js src/99-tail.html > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
