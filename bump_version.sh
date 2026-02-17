#!/bin/bash
# Script para incrementar la versión automáticamente
# Uso: ./bump_version.sh

VERSION_FILE="public/version.json"
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' "$VERSION_FILE" | cut -d'"' -f4)

echo "📦 Versión actual: $CURRENT_VERSION"

# Parse version
IFS='.' read -r -a parts <<< "$CURRENT_VERSION"
major=${parts[0]}
minor=${parts[1]}
patch=${parts[2]}

# Increment patch version
new_patch=$((patch + 1))
NEW_VERSION="$major.$minor.$new_patch"

# Update version.json with new version and timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$VERSION_FILE" <<EOF
{
  "version": "$NEW_VERSION",
  "buildTime": "$BUILD_TIME",
  "features": [
    "Real-time host sync",
    "Real-time opponent selection sync",
    "Auto-update system"
  ]
}
EOF

echo "✅ Nueva versión: $NEW_VERSION"
echo "⏰ Build time: $BUILD_TIME"
echo ""
echo "🚀 Ahora todos los dispositivos se actualizarán automáticamente en ~30 segundos"
