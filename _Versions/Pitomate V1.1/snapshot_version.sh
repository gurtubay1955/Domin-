#!/bin/bash

# snapshot_version.sh
# Usage: ./snapshot_version.sh "Version Name"
# Example: ./snapshot_version.sh "Pitomate V1.0"

VERSION_NAME="$1"

if [ -z "$VERSION_NAME" ]; then
  echo "Error: Version name is required."
  echo "Usage: ./snapshot_version.sh \"Version Name\""
  exit 1
fi

# Define source and destination
SOURCE_DIR=$(pwd)
DEST_DIR="$SOURCE_DIR/Versions/$VERSION_NAME"

# Create destination directory
mkdir -p "$DEST_DIR"

echo "📸 Creating snapshot: $VERSION_NAME"
echo "📂 Destination: $DEST_DIR"

# Copy files and directories, excluding node_modules, .next, .git, and Versions itself
# using rsync for efficiency and exclusion
if command -v rsync &> /dev/null; then
    rsync -av --progress "$SOURCE_DIR/" "$DEST_DIR/" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'Versions' \
    --exclude '.gemini' \
    --exclude 'tmp'
else
    # Fallback to cp if rsync is not available (less likely on Mac/Linux but safe)
    echo "⚠️ rsync not found, using cp (might be slower and less precise)"
    cp -r "$SOURCE_DIR/app" "$DEST_DIR/"
    cp -r "$SOURCE_DIR/components" "$DEST_DIR/"
    cp -r "$SOURCE_DIR/lib" "$DEST_DIR/"
    cp -r "$SOURCE_DIR/public" "$DEST_DIR/"
    cp -r "$SOURCE_DIR/Braian" "$DEST_DIR/"
    cp "$SOURCE_DIR/package.json" "$DEST_DIR/"
    cp "$SOURCE_DIR/package-lock.json" "$DEST_DIR/"
    cp "$SOURCE_DIR/tsconfig.json" "$DEST_DIR/"
    cp "$SOURCE_DIR/next.config.ts" "$DEST_DIR/"
    cp "$SOURCE_DIR/tailwind.config.ts" "$DEST_DIR/"
    cp "$SOURCE_DIR/postcss.config.mjs" "$DEST_DIR/"
    cp "$SOURCE_DIR/.env.local" "$DEST_DIR/"
    cp "$SOURCE_DIR/README.md" "$DEST_DIR/"
    cp "$SOURCE_DIR/reset_db.sql" "$DEST_DIR/"
    cp "$SOURCE_DIR/supabase_schema.sql" "$DEST_DIR/"
fi

echo "✅ Snapshot $VERSION_NAME created successfully!"
