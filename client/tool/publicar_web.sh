#!/usr/bin/env bash
# Compila la versión web y la copia a server/public, que es lo que publica la
# API. CanvasKit no se copia: el navegador lo carga desde el CDN de Flutter.
set -euo pipefail
cd "$(dirname "$0")/.."
flutter build web --release
rm -rf ../server/public
cp -r build/web ../server/public
rm -rf ../server/public/canvaskit
echo "Versión web copiada a server/public"
