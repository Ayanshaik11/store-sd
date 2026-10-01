#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "📸 Photo Storage setup"
echo "Available storage mounts:"
ls /storage || true
echo
read -p "Enter SD-card ID (example 1234-ABCD): " SD_ID

if [ -z "$SD_ID" ]; then
  echo "No SD-card ID entered."
  exit 1
fi

export PHOTO_DIR="/storage/$SD_ID/PhotoStorage"

mkdir -p "$PHOTO_DIR"
echo
echo "Using: $PHOTO_DIR"
echo
echo "Installing dependencies..."
npm install

echo
echo "Starting server..."
node server.js
